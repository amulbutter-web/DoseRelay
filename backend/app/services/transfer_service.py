"""Ordered transfer authorization, atomic reservations and receiver inventory reconciliation."""

import uuid, io, json
from datetime import date, datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy import or_
from app.models.transfer import Transfer, TransferRecommendation
from app.models.medicine import Medicine, MedicineBatch
from app.models.user import User
from app.models.audit import AuditLog, Notification
from app.models.verification import MedicineRequest, FacilityRegistration
from app.services.verification_service import approved_facility

VALID_TRANSITIONS = {
    "open_awaiting_donor": ["donor_review", "cancelled"],
    "donor_review": ["donor_approved", "donor_rejected", "cancelled"],
    "donor_approved": ["awaiting_mto_review", "cancelled"],
    "donor_rejected": [],
    "awaiting_mto_review": [
        "final_approved",
        "mto_rejected",
        "mto_requested_documents",
        "donor_review",
        "cancelled",
    ],
    "mto_requested_documents": ["awaiting_mto_review", "cancelled"],
    "final_approved": ["ready_for_dispatch", "cancelled"],
    "ready_for_dispatch": ["dispatched", "cancelled"],
    "dispatched": ["in_transit"],
    "in_transit": ["delivered"],
    "delivered": ["received_awaiting_verification"],
    "received_awaiting_verification": ["completed"],
    "completed": [],
    "cancelled": [],
    "mto_rejected": [],
}
PENDING_STATUSES = [s for s, v in VALID_TRANSITIONS.items() if v]


def validate_transition(current, next_status):
    if next_status not in VALID_TRANSITIONS.get(current, []):
        raise HTTPException(
            400, f"Invalid status transition: {current} → {next_status}"
        )


def generate_qr_token():
    return str(uuid.uuid4())


def generate_qr_image_bytes(token, base_url=None):
    import qrcode, os

    url = (
        (base_url or os.getenv("FRONTEND_URL", "http://localhost:5173")).rstrip("/")
        + "/transfer/verify/"
        + token
    )
    buf = io.BytesIO()
    qrcode.make(url).save(buf, format="PNG")
    return buf.getvalue()


def reserve_stock(db, batch_id, quantity):
    if quantity <= 0:
        raise HTTPException(400, "Quantity must be positive")
    batch = db.query(MedicineBatch).filter_by(id=batch_id).with_for_update().first()
    if not batch:
        raise HTTPException(404, "Batch not found")
    # Serialize allocations at facility level, including SQLite where FOR UPDATE is ignored.
    db.query(FacilityRegistration).filter_by(hospital_id=batch.hospital_id).update(
        {
            FacilityRegistration.registration_status: FacilityRegistration.registration_status
        },
        synchronize_session=False,
    )
    from app.services.inventory_service import (
        get_avg_daily_consumption,
        calculate_surplus,
        SAFETY_STOCK_DAYS,
    )

    eligible = (
        db.query(MedicineBatch)
        .filter(
            MedicineBatch.hospital_id == batch.hospital_id,
            MedicineBatch.medicine_id == batch.medicine_id,
            MedicineBatch.expiry_date > date.today(),
            MedicineBatch.status.in_(["normal", "approaching_expiry", "critical"]),
        )
        .populate_existing()
        .with_for_update()
        .all()
    )
    daily = get_avg_daily_consumption(db, batch.hospital_id, batch.medicine_id)
    surplus = calculate_surplus(
        sum(b.quantity for b in eligible),
        daily * 30,
        daily * SAFETY_STOCK_DAYS,
        sum(b.reserved_quantity for b in eligible),
    )
    if quantity > surplus:
        raise HTTPException(
            409,
            "Offered quantity exceeds available surplus after demand and safety stock",
        )
    n = (
        db.query(MedicineBatch)
        .filter(
            MedicineBatch.id == batch_id,
            MedicineBatch.expiry_date > date.today(),
            MedicineBatch.status.in_(["normal", "approaching_expiry", "critical"]),
            MedicineBatch.quantity - MedicineBatch.reserved_quantity >= quantity,
        )
        .update(
            {
                MedicineBatch.reserved_quantity: MedicineBatch.reserved_quantity
                + quantity
            },
            synchronize_session="fetch",
        )
    )
    if n != 1:
        raise HTTPException(
            409,
            "Stock is unavailable, expired, recalled, quarantined, damaged or reserved",
        )


def release_stock(db, batch_id, quantity):
    n = (
        db.query(MedicineBatch)
        .filter(
            MedicineBatch.id == batch_id, MedicineBatch.reserved_quantity >= quantity
        )
        .update(
            {
                MedicineBatch.reserved_quantity: MedicineBatch.reserved_quantity
                - quantity
            },
            synchronize_session="fetch",
        )
    )
    if n != 1:
        raise HTTPException(
            409, "Reservation mismatch; administrator reconciliation required"
        )


def deduct_stock(db, batch_id, quantity):
    n = (
        db.query(MedicineBatch)
        .filter(
            MedicineBatch.id == batch_id,
            MedicineBatch.quantity >= quantity,
            MedicineBatch.reserved_quantity >= quantity,
        )
        .update(
            {
                MedicineBatch.quantity: MedicineBatch.quantity - quantity,
                MedicineBatch.reserved_quantity: MedicineBatch.reserved_quantity
                - quantity,
            },
            synchronize_session="fetch",
        )
    )
    if n != 1:
        raise HTTPException(409, "Inventory changed; cannot reconcile receipt")


def get_transfer(db, id):
    t = db.query(Transfer).filter_by(id=id).with_for_update().first()
    if not t:
        raise HTTPException(404, "Transfer not found")
    return t


def authorize_facility(db, user, facility_id):
    if (
        user.role not in ("pharmacist", "hospital_admin")
        or user.hospital_id != facility_id
    ):
        raise HTTPException(
            403, "Only the responsible facility can perform this action"
        )
    approved_facility(db, facility_id)


def move(db, t, status, user_id, notes=""):
    old = t.status
    validate_transition(old, status)
    n = (
        db.query(Transfer)
        .filter_by(id=t.id, status=old)
        .update({"status": status}, synchronize_session=False)
    )
    if n != 1:
        raise HTTPException(409, "Transfer changed concurrently; refresh and retry")
    t.status = status
    r = db.query(MedicineRequest).filter_by(transfer_id=t.id).first()
    if r:
        r.status = status
    log_action(db, user_id, status.upper(), "transfer", t.id, notes)


def create_transfer(db, data, user_id):
    u = db.get(User, user_id)
    b = db.get(MedicineBatch, data.batch_id)
    if not b:
        raise HTTPException(404, "Batch not found")
    med = db.get(Medicine, data.medicine_id)
    if not med:
        raise HTTPException(404, "Medicine not found")

    # Reserve stock on the batch
    current_reserved = b.reserved_quantity or 0
    qty_to_reserve = min(data.quantity, b.quantity)
    b.reserved_quantity = current_reserved + qty_to_reserve

    # If linked to a recommendation, mark recommendation as accepted
    if data.recommendation_id:
        rec = db.query(TransferRecommendation).filter_by(id=data.recommendation_id).first()
        if rec:
            rec.status = "accepted"
            db.add(rec)

    now = datetime.now(timezone.utc)
    t = Transfer(
        recommendation_id=data.recommendation_id,
        donor_hospital_id=data.donor_hospital_id,
        receiver_hospital_id=data.receiver_hospital_id,
        medicine_id=data.medicine_id,
        batch_id=data.batch_id,
        quantity=data.quantity,
        status="awaiting_mto_review",
        qr_code_token=generate_qr_token(),
        donor_pharmacist_id=user_id if u and u.hospital_id == data.donor_hospital_id else None,
        donor_approval_at=now,
        donor_notes="Stock authorized and reserved from AI Recommendation",
        estimated_delivery=datetime.combine(date.today() + timedelta(days=7), datetime.max.time()),
    )
    db.add(t)
    db.flush()

    req_id = str(uuid.uuid4())
    req_data = {
        "medicine_name": med.name,
        "active_ingredient": med.active_ingredient or "",
        "strength": med.strength or "",
        "dosage_form": med.dosage_form or "",
        "quantity": data.quantity,
        "required_delivery_date": (date.today() + timedelta(days=7)).isoformat(),
        "storage_capability": "Standard cold chain / room temperature",
        "reason": f"AI Recommendation #{data.recommendation_id or ''} accepted",
        "created_at": now.isoformat(),
        "created_by": user_id,
        "transfer_reference": "TR-" + uuid.uuid4().hex[:8].upper(),
    }
    r = MedicineRequest(
        id=req_id,
        receiver_id=data.receiver_hospital_id,
        status="awaiting_mto_review",
        transfer_id=t.id,
        data=req_data,
    )
    db.add(r)

    log_action(db, user_id, "RECOMMENDATION_ACCEPTED", "transfer", t.id, f"Accepted recommendation #{data.recommendation_id}")
    log_action(db, user_id, "TRANSFER_CREATED", "transfer", t.id, f"Transfer created for {data.quantity} units")
    log_action(db, user_id, "DONOR_APPROVED", "transfer", t.id, "Donor stock authorized and reserved")
    log_action(db, user_id, "AWAITING_MTO_REVIEW", "transfer", t.id, "Transfer queued for MTO review")

    db.commit()
    db.refresh(t)
    return t


def mto_review(db, transfer_id, mto_id, approved, notes):
    u = db.get(User, mto_id)
    if u.role != "mto":
        raise HTTPException(403, "Only the central MTO can approve")
    t = get_transfer(db, transfer_id)
    if t.status != "awaiting_mto_review" or not t.donor_approval_at:
        raise HTTPException(400, "Donor approval is required before MTO review")
    if approved:
        for fid in [t.donor_hospital_id, t.receiver_hospital_id]:
            approved_facility(db, fid)
    b = db.get(MedicineBatch, t.batch_id)
    if approved and (
        b.expiry_date <= date.today()
        or b.status not in ("normal", "approaching_expiry", "critical")
        or b.reserved_quantity < t.quantity
    ):
        raise HTTPException(409, "Batch is no longer eligible")
    t.mto_id = mto_id
    t.mto_notes = notes
    if approved:
        if not notes or not notes.strip():
            raise HTTPException(400, "MTO review findings are required")
        move(db, t, "final_approved", mto_id, notes)
        t.qr_code_token = generate_qr_token()
        r = db.query(MedicineRequest).filter_by(transfer_id=t.id).first()
        r.data = {
            **r.data,
            "transfer_reference": "TR-" + uuid.uuid4().hex.upper(),
            "mto_approved_at": datetime.now(timezone.utc).isoformat(),
        }
        move(
            db,
            t,
            "ready_for_dispatch",
            mto_id,
            "Internal approval; statutory permissions remain required",
        )
        for recipient in (
            db.query(User)
            .filter(
                or_(
                    User.hospital_id.in_([t.donor_hospital_id, t.receiver_hospital_id]),
                    User.role == "logistics",
                )
            )
            .all()
        ):
            db.add(
                Notification(
                    user_id=recipient.id,
                    title="Final MTO approval",
                    message=f"Transfer {t.id} ready for dispatch",
                    link=f"/transfers/{t.id}",
                )
            )
    else:
        if not notes:
            raise HTTPException(400, "Rejection reason required")
        move(db, t, "mto_rejected", mto_id, notes)
        release_stock(db, t.batch_id, t.quantity)
        t.rejection_reason = notes
    db.commit()
    db.refresh(t)
    return t


def donor_approval(db, transfer_id, pharmacist_id, approved, notes):
    t = get_transfer(db, transfer_id)
    u = db.get(User, pharmacist_id)
    authorize_facility(db, u, t.donor_hospital_id)
    if t.status != "donor_review":
        raise HTTPException(
            400, "Use the request offer form to approve available stock"
        )
    if approved:
        reserve_stock(db, t.batch_id, t.quantity)
        t.donor_notes = notes
        t.donor_approval_at = datetime.now(timezone.utc)
        t.donor_pharmacist_id = u.id
        move(db, t, "donor_approved", u.id, notes)
        move(db, t, "awaiting_mto_review", u.id, notes)
    else:
        move(db, t, "donor_rejected", u.id, notes)
    db.commit()
    return t


def receiver_approval(*args, **kwargs):
    raise HTTPException(
        400,
        "Receiver confirmation is available only after delivery through receipt verification",
    )


def update_transfer_status(
    db,
    transfer_id,
    new_status,
    user_id,
    notes=None,
    rejection_reason=None,
    cancellation_reason=None,
):
    t = get_transfer(db, transfer_id)
    u = db.get(User, user_id)
    if new_status == "cancelled":
        if u.role != "mto":
            authorize_facility(db, u, t.receiver_hospital_id)
        if not (notes or cancellation_reason):
            raise HTTPException(400, "Cancellation reason required")
        old = t.status
        t.cancellation_reason = notes or cancellation_reason
        move(db, t, new_status, user_id, notes or cancellation_reason)
        if old not in ("donor_review", "open_awaiting_donor"):
            release_stock(db, t.batch_id, t.quantity)
    elif new_status in ("dispatched", "in_transit", "delivered"):
        if u.role != "logistics":
            raise HTTPException(
                403, "Only logistics personnel can update shipment status"
            )
        if not t.mto_id or not t.qr_code_token or not t.donor_approval_at:
            raise HTTPException(403, "Final MTO approval required")
        if new_status == "dispatched" and (not t.dispatch_date or not t.delivery_notes):
            raise HTTPException(400, "Dispatch details required")
        if new_status == "delivered" and (not t.actual_delivery or not notes):
            raise HTTPException(
                400, "Delivery timestamp and receiving person/remarks required"
            )
        if new_status == "in_transit" and not notes:
            raise HTTPException(400, "Location/progress remarks required")
        move(db, t, new_status, user_id, notes)
        if new_status == "delivered":
            move(
                db,
                t,
                "received_awaiting_verification",
                user_id,
                "Awaiting receiver checks",
            )
    else:
        raise HTTPException(403, "Use the dedicated authorized workflow action")
    db.commit()
    db.refresh(t)
    return t


def confirm_receipt(db, t, u, data):
    authorize_facility(db, u, t.receiver_hospital_id)
    if t.status != "received_awaiting_verification":
        raise HTTPException(
            400,
            "Delivery must precede receiver verification; receipt may only be confirmed once",
        )
    b = db.get(MedicineBatch, t.batch_id)
    if data.discrepancy:
        if not data.notes:
            raise HTTPException(400, "Describe the discrepancy")
        log_action(db, u.id, "RECEIVER_DISCREPANCY", "transfer", t.id, data.notes)
        from app.models.audit import Notification

        for recipient in (
            db.query(User)
            .filter(or_(User.role == "mto", User.hospital_id == t.donor_hospital_id))
            .all()
        ):
            db.add(
                Notification(
                    user_id=recipient.id,
                    title="Receiver discrepancy",
                    message=data.notes,
                    link=f"/transfers/{t.id}",
                )
            )
        db.commit()
        return t
    from app.models.medicine import Medicine

    if (
        b.expiry_date <= date.today()
        or data.received_quantity != t.quantity
        or data.batch_number != b.batch_number
        or data.expiry_date != b.expiry_date
        or data.medicine_name != db.get(Medicine, t.medicine_id).name
        or not data.packaging_ok
        or not data.storage_transport_ok
    ):
        raise HTTPException(400, "Receipt checks do not match; report a discrepancy")
    log_action(db, u.id, "RECEIVER_VERIFIED", "transfer", t.id, data.notes)
    move(db, t, "completed", u.id, data.notes)
    deduct_stock(db, b.id, t.quantity)
    target = (
        db.query(MedicineBatch)
        .filter_by(
            hospital_id=t.receiver_hospital_id,
            medicine_id=t.medicine_id,
            batch_number=b.batch_number,
        )
        .with_for_update()
        .first()
    )
    if target:
        if target.expiry_date != b.expiry_date or target.status in (
            "recalled",
            "quarantined",
            "damaged",
            "expired",
        ):
            raise HTTPException(
                409, "Receiving batch conflicts; reconcile before confirmation"
            )
        db.query(MedicineBatch).filter_by(id=target.id).update(
            {MedicineBatch.quantity: MedicineBatch.quantity + t.quantity},
            synchronize_session="fetch",
        )
    else:
        db.add(
            MedicineBatch(
                hospital_id=t.receiver_hospital_id,
                medicine_id=t.medicine_id,
                batch_number=b.batch_number,
                quantity=t.quantity,
                reserved_quantity=0,
                expiry_date=b.expiry_date,
                manufacturing_date=b.manufacturing_date,
                unit_price=b.unit_price,
                storage_temp_min=b.storage_temp_min,
                storage_temp_max=b.storage_temp_max,
                status=b.status,
            )
        )
    t.receipt_verified = True
    t.received_quantity = data.received_quantity
    t.receiver_pharmacist_id = u.id
    t.receiver_approval_at = datetime.now(timezone.utc)
    t.receiver_notes = data.notes
    db.commit()
    db.refresh(t)
    return t


def verify_by_qr(db, token):
    return db.query(Transfer).filter_by(qr_code_token=token).first()


def log_action(db, user_id, action, entity_type, entity_id, details):
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            created_at=datetime.now(timezone.utc),
        )
    )
