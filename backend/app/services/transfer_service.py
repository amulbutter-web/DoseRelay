"""Transfer workflow service: status transitions, QR, stock reservation."""
import uuid
import io
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.transfer import Transfer, TransferRecommendation
from app.models.medicine import MedicineBatch
from app.models.audit import AuditLog
from app.schemas.transfer import TransferCreate

# Valid status transitions
VALID_TRANSITIONS = {
    "recommended": ["pending_mto_review", "cancelled"],
    "pending_mto_review": ["awaiting_donor_approval", "rejected", "cancelled"],
    "awaiting_donor_approval": ["awaiting_receiver_approval", "rejected", "cancelled"],
    "awaiting_receiver_approval": ["approved", "rejected", "cancelled"],
    "approved": ["ready_for_dispatch", "cancelled"],
    "ready_for_dispatch": ["dispatched", "cancelled"],
    "dispatched": ["in_transit"],
    "in_transit": ["delivered"],
    "delivered": ["receipt_verified"],
    "receipt_verified": ["completed"],
    "rejected": [],
    "cancelled": [],
    "completed": [],
}

PENDING_STATUSES = [
    "recommended", "pending_mto_review",
    "awaiting_donor_approval", "awaiting_receiver_approval",
    "approved", "ready_for_dispatch", "dispatched", "in_transit", "delivered", "receipt_verified"
]


def validate_transition(current: str, next_status: str) -> None:
    """Raise HTTPException if the status transition is invalid."""
    allowed = VALID_TRANSITIONS.get(current, [])
    if next_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from '{current}' to '{next_status}'. Allowed: {allowed}",
        )


def generate_qr_token() -> str:
    """Generate a unique QR code token."""
    return str(uuid.uuid4())


def generate_qr_image_bytes(token: str, base_url: str = "http://localhost:5173") -> bytes:
    """Generate a QR code PNG for the transfer verification URL."""
    try:
        import qrcode
        from PIL import Image
        url = f"{base_url}/transfer/verify/{token}"
        qr = qrcode.QRCode(version=1, box_size=8, border=4)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#1e3a5f", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception:
        return b""


def reserve_stock(db: Session, batch_id: int, quantity: int) -> None:
    """Reserve stock on a batch to prevent duplicate transfers."""
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).with_for_update().first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    available = batch.quantity - batch.reserved_quantity
    if available < quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient available stock. Available: {available}, requested: {quantity}",
        )
    batch.reserved_quantity += quantity
    db.flush()


def release_stock(db: Session, batch_id: int, quantity: int) -> None:
    """Release previously reserved stock."""
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if batch:
        batch.reserved_quantity = max(0, batch.reserved_quantity - quantity)
        db.flush()


def deduct_stock(db: Session, batch_id: int, quantity: int) -> None:
    """Permanently deduct stock from a batch on transfer completion."""
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).with_for_update().first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    batch.quantity = max(0, batch.quantity - quantity)
    batch.reserved_quantity = max(0, batch.reserved_quantity - quantity)
    db.flush()


def create_transfer(db: Session, data: TransferCreate, user_id: int) -> Transfer:
    """Create a new transfer and reserve stock."""
    # Validate batch eligibility
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == data.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if batch.status in ("expired", "quarantined", "recalled"):
        raise HTTPException(status_code=400, detail=f"Batch status '{batch.status}' is not eligible for transfer")

    with db.begin_nested():
        reserve_stock(db, data.batch_id, data.quantity)
        transfer = Transfer(
            recommendation_id=data.recommendation_id,
            donor_hospital_id=data.donor_hospital_id,
            receiver_hospital_id=data.receiver_hospital_id,
            medicine_id=data.medicine_id,
            batch_id=data.batch_id,
            quantity=data.quantity,
            status="pending_mto_review",
        )
        db.add(transfer)
        db.flush()

        # Mark recommendation accepted
        if data.recommendation_id:
            rec = db.query(TransferRecommendation).filter(
                TransferRecommendation.id == data.recommendation_id
            ).first()
            if rec:
                rec.status = "accepted"

        log_action(db, user_id, "CREATE_TRANSFER", "transfer", transfer.id,
                   f"Transfer created: {data.quantity} units, batch {data.batch_id}")

    db.refresh(transfer)
    return transfer


def update_transfer_status(
    db: Session, transfer_id: int, new_status: str,
    user_id: int, notes: Optional[str] = None,
    rejection_reason: Optional[str] = None,
    cancellation_reason: Optional[str] = None,
) -> Transfer:
    """Update transfer status with validation."""
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    validate_transition(transfer.status, new_status)
    old_status = transfer.status
    transfer.status = new_status

    if new_status == "rejected":
        transfer.rejection_reason = rejection_reason or notes
        release_stock(db, transfer.batch_id, transfer.quantity)
    elif new_status == "cancelled":
        transfer.cancellation_reason = cancellation_reason or notes
        release_stock(db, transfer.batch_id, transfer.quantity)
    elif new_status == "approved":
        transfer.qr_code_token = generate_qr_token()
    elif new_status == "completed":
        deduct_stock(db, transfer.batch_id, transfer.quantity)

    log_action(db, user_id, f"STATUS_{new_status.upper()}", "transfer", transfer_id,
               f"Status changed {old_status} → {new_status}. Notes: {notes}")
    db.commit()
    db.refresh(transfer)
    return transfer


def mto_review(db: Session, transfer_id: int, mto_id: int, approved: bool, notes: Optional[str]) -> Transfer:
    """MTO reviews and either advances or rejects a transfer."""
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status != "pending_mto_review":
        raise HTTPException(status_code=400, detail=f"Transfer is not pending MTO review (status: {transfer.status})")

    transfer.mto_id = mto_id
    transfer.mto_notes = notes

    if approved:
        transfer.status = "awaiting_donor_approval"
        log_action(db, mto_id, "MTO_APPROVED", "transfer", transfer_id, notes or "MTO approved")
    else:
        transfer.status = "rejected"
        transfer.rejection_reason = notes or "Rejected by MTO"
        release_stock(db, transfer.batch_id, transfer.quantity)
        log_action(db, mto_id, "MTO_REJECTED", "transfer", transfer_id, notes or "MTO rejected")

    db.commit()
    db.refresh(transfer)
    return transfer


def donor_approval(db: Session, transfer_id: int, pharmacist_id: int, approved: bool, notes: Optional[str]) -> Transfer:
    """Donor pharmacist approves or rejects the transfer."""
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status != "awaiting_donor_approval":
        raise HTTPException(status_code=400, detail=f"Transfer not awaiting donor approval (status: {transfer.status})")

    transfer.donor_pharmacist_id = pharmacist_id
    transfer.donor_approval_at = datetime.now(timezone.utc)
    transfer.donor_notes = notes

    if approved:
        transfer.status = "awaiting_receiver_approval"
        log_action(db, pharmacist_id, "DONOR_APPROVED", "transfer", transfer_id, notes)
    else:
        transfer.status = "rejected"
        transfer.rejection_reason = notes or "Rejected by donor pharmacist"
        release_stock(db, transfer.batch_id, transfer.quantity)
        log_action(db, pharmacist_id, "DONOR_REJECTED", "transfer", transfer_id, notes)

    db.commit()
    db.refresh(transfer)
    return transfer


def receiver_approval(db: Session, transfer_id: int, pharmacist_id: int, approved: bool, notes: Optional[str]) -> Transfer:
    """Receiver pharmacist approves or rejects the transfer."""
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status != "awaiting_receiver_approval":
        raise HTTPException(status_code=400, detail=f"Transfer not awaiting receiver approval (status: {transfer.status})")

    transfer.receiver_pharmacist_id = pharmacist_id
    transfer.receiver_approval_at = datetime.now(timezone.utc)
    transfer.receiver_notes = notes

    if approved:
        transfer.status = "approved"
        transfer.qr_code_token = generate_qr_token()
        log_action(db, pharmacist_id, "RECEIVER_APPROVED", "transfer", transfer_id, notes)
    else:
        transfer.status = "rejected"
        transfer.rejection_reason = notes or "Rejected by receiver pharmacist"
        release_stock(db, transfer.batch_id, transfer.quantity)
        log_action(db, pharmacist_id, "RECEIVER_REJECTED", "transfer", transfer_id, notes)

    db.commit()
    db.refresh(transfer)
    return transfer


def verify_by_qr(db: Session, token: str) -> Optional[Transfer]:
    """Look up transfer by QR token."""
    return db.query(Transfer).filter(Transfer.qr_code_token == token).first()


def log_action(db: Session, user_id: Optional[int], action: str, entity_type: str, entity_id: int, details: Optional[str]) -> None:
    """Write an audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(entry)
