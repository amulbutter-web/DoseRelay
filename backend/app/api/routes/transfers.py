"""Transfer management routes: full workflow, QR, approvals."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.core.security import get_current_user
from app.models.transfer import Transfer, TransferRecommendation
from app.models.hospital import Hospital
from app.models.medicine import Medicine, MedicineBatch
from app.schemas.transfer import (
    TransferCreate, TransferResponse, TransferStatusUpdate,
    MTOReview, PharmacistApproval, LogisticsUpdate, ReceiptVerification,
    RecommendationResponse,
)
from app.services import transfer_service
from app.ai.matching import generate_recommendations

router = APIRouter(prefix="/transfers", tags=["Transfers"])


def _enrich_transfer(t: Transfer, db: Session) -> TransferResponse:
    resp = TransferResponse.model_validate(t)
    dh = db.query(Hospital).filter(Hospital.id == t.donor_hospital_id).first()
    rh = db.query(Hospital).filter(Hospital.id == t.receiver_hospital_id).first()
    med = db.query(Medicine).filter(Medicine.id == t.medicine_id).first()
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == t.batch_id).first()
    resp.donor_hospital_name = dh.name if dh else None
    resp.receiver_hospital_name = rh.name if rh else None
    resp.medicine_name = med.name if med else None
    resp.batch_number = batch.batch_number if batch else None
    return resp


def _enrich_recommendation(r: TransferRecommendation, db: Session) -> RecommendationResponse:
    resp = RecommendationResponse.model_validate(r)
    dh = db.query(Hospital).filter(Hospital.id == r.donor_hospital_id).first()
    rh = db.query(Hospital).filter(Hospital.id == r.receiver_hospital_id).first()
    med = db.query(Medicine).filter(Medicine.id == r.medicine_id).first()
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == r.batch_id).first()
    resp.donor_hospital_name = dh.name if dh else None
    resp.receiver_hospital_name = rh.name if rh else None
    resp.medicine_name = med.name if med else None
    resp.batch_number = batch.batch_number if batch else None
    resp.expiry_date = batch.expiry_date.isoformat() if batch else None
    return resp


# ── Recommendations ───────────────────────────────────────────────────────────

@router.post("/recommendations/generate", response_model=List[RecommendationResponse])
def gen_recommendations(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "mto"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    recs = generate_recommendations(db)
    return [_enrich_recommendation(r, db) for r in recs]


@router.get("/recommendations", response_model=List[RecommendationResponse])
def list_recommendations(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(TransferRecommendation)
    if status:
        q = q.filter(TransferRecommendation.status == status)
    return [_enrich_recommendation(r, db) for r in q.order_by(TransferRecommendation.created_at.desc()).all()]


@router.put("/recommendations/{rec_id}/reject")
def reject_recommendation(rec_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "mto"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    rec = db.query(TransferRecommendation).filter(TransferRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    rec.status = "rejected"
    db.commit()
    return {"message": "Recommendation rejected"}


# ── Transfers ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[TransferResponse])
def list_transfers(
    status: Optional[str] = Query(None),
    hospital_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Transfer)
    if status:
        q = q.filter(Transfer.status == status)
    if hospital_id:
        q = q.filter(
            (Transfer.donor_hospital_id == hospital_id) |
            (Transfer.receiver_hospital_id == hospital_id)
        )
    transfers = q.order_by(Transfer.created_at.desc()).offset(skip).limit(limit).all()
    return [_enrich_transfer(t, db) for t in transfers]


@router.post("", response_model=TransferResponse, status_code=201)
def create_transfer(data: TransferCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "mto", "hospital_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    t = transfer_service.create_transfer(db, data, current_user.id)
    return _enrich_transfer(t, db)


@router.get("/{transfer_id}", response_model=TransferResponse)
def get_transfer(transfer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return _enrich_transfer(t, db)


@router.put("/{transfer_id}/mto-review", response_model=TransferResponse)
def mto_review_endpoint(transfer_id: int, data: MTOReview, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "mto"):
        raise HTTPException(status_code=403, detail="Only MTO can review transfers")
    t = transfer_service.mto_review(db, transfer_id, current_user.id, data.approved, data.notes)
    return _enrich_transfer(t, db)


@router.put("/{transfer_id}/donor-approval", response_model=TransferResponse)
def donor_approval_endpoint(transfer_id: int, data: PharmacistApproval, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "pharmacist"):
        raise HTTPException(status_code=403, detail="Only pharmacists can approve")
    t = transfer_service.donor_approval(db, transfer_id, current_user.id, data.approved, data.notes)
    return _enrich_transfer(t, db)


@router.put("/{transfer_id}/receiver-approval", response_model=TransferResponse)
def receiver_approval_endpoint(transfer_id: int, data: PharmacistApproval, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "pharmacist"):
        raise HTTPException(status_code=403, detail="Only pharmacists can approve")
    t = transfer_service.receiver_approval(db, transfer_id, current_user.id, data.approved, data.notes)
    return _enrich_transfer(t, db)


@router.put("/{transfer_id}/logistics", response_model=TransferResponse)
def update_logistics(transfer_id: int, data: LogisticsUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "mto", "logistics"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    t.logistics_personnel_id = current_user.id
    for f, v in data.model_dump(exclude_unset=True).items():
        setattr(t, f, v)
    db.commit()
    db.refresh(t)
    return _enrich_transfer(t, db)


@router.put("/{transfer_id}/status", response_model=TransferResponse)
def update_status(transfer_id: int, data: TransferStatusUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    t = transfer_service.update_transfer_status(
        db, transfer_id, data.status, current_user.id,
        data.notes, data.rejection_reason, data.cancellation_reason,
    )
    return _enrich_transfer(t, db)


@router.put("/{transfer_id}/receipt", response_model=TransferResponse)
def verify_receipt(transfer_id: int, data: ReceiptVerification, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if t.status != "delivered":
        raise HTTPException(status_code=400, detail=f"Transfer not in delivered status (is: {t.status})")
    t.received_quantity = data.received_quantity
    t.delivery_notes = data.notes
    t.status = "receipt_verified"
    db.commit()
    db.refresh(t)
    return _enrich_transfer(t, db)


@router.get("/{transfer_id}/qr-code")
def get_qr_code(transfer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if not t.qr_code_token:
        raise HTTPException(status_code=400, detail="QR code not yet generated (transfer must be approved)")
    img_bytes = transfer_service.generate_qr_image_bytes(t.qr_code_token)
    return Response(content=img_bytes, media_type="image/png")


@router.get("/verify/{token}", response_model=TransferResponse)
def verify_by_qr_token(token: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = transfer_service.verify_by_qr(db, token)
    if not t:
        raise HTTPException(status_code=404, detail="Invalid or expired QR token")
    return _enrich_transfer(t, db)
