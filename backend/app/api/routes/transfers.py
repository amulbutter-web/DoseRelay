"""Transfer management routes: full workflow, QR, approvals."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.core.security import get_current_user
from app.models.transfer import Transfer, TransferRecommendation
from app.models.hospital import Hospital
from app.models.medicine import Medicine, MedicineBatch
from app.models.user import User
from app.models.audit import AuditLog, Notification
from app.models.verification import MedicineRequest, FacilityRegistration
from app.api.routes.registration import read_document
from app.models.verification import VerificationDocument
from fastapi import UploadFile, File, Form
from pydantic import BaseModel
import uuid
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
    if batch and batch.expiry_date:
        resp.expiry_date = batch.expiry_date.strftime("%Y-%m-%d")
    if t.mto_id:
        m_user = db.query(User).filter(User.id == t.mto_id).first()
        resp.mto_name = m_user.full_name or m_user.username if m_user else None
    if t.donor_pharmacist_id:
        d_user = db.query(User).filter(User.id == t.donor_pharmacist_id).first()
        resp.donor_pharmacist_name = d_user.full_name or d_user.username if d_user else None
    if t.receiver_pharmacist_id:
        r_user = db.query(User).filter(User.id == t.receiver_pharmacist_id).first()
        resp.receiver_pharmacist_name = r_user.full_name or r_user.username if r_user else None
    if t.logistics_personnel_id:
        l_user = db.query(User).filter(User.id == t.logistics_personnel_id).first()
        resp.logistics_personnel_name = l_user.full_name or l_user.username if l_user else None
    request = db.query(MedicineRequest).filter_by(transfer_id=t.id).first()
    if request:
        resp.request_id = request.id
        resp.transfer_reference = request.data.get('transfer_reference')
        resp.mto_approved_at = request.data.get('mto_approved_at')
        resp.request_details = request.data
    resp.active_ingredient = med.active_ingredient if med else None
    resp.strength = med.strength if med else None
    resp.dosage_form = med.dosage_form if med else None
    resp.facility_verification = {}
    for name, fid in [('donor', t.donor_hospital_id), ('receiver', t.receiver_hospital_id)]:
        reg = db.query(FacilityRegistration).filter_by(hospital_id=fid).first()
        if reg: resp.facility_verification[name] = {'nin': reg.nin, 'nin_status': reg.nin_status, 'licence_status': reg.licence_status, 'registration_status': reg.registration_status, 'licence_validity': reg.data.get('licence_validity'), 'nin_document_id': reg.data.get('nin_document_id'), 'licence_document_id': reg.data.get('licence_document_id')}
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
    if current_user.role not in ("network_admin", "mto", "hospital_admin", "pharmacist"):
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
    if _.role == 'logistics':
        q = q.filter(Transfer.mto_id.isnot(None), Transfer.donor_approval_at.isnot(None), Transfer.qr_code_token.isnot(None), Transfer.status.in_(['final_approved','ready_for_dispatch','dispatched','in_transit','delivered','received_awaiting_verification','completed']))
    if _.role in ('pharmacist', 'hospital_admin'):
        q = q.filter((Transfer.donor_hospital_id == _.hospital_id) | (Transfer.receiver_hospital_id == _.hospital_id))
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
    if current_user.role not in ("network_admin", "mto", "hospital_admin", "pharmacist"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    t = transfer_service.create_transfer(db, data, current_user.id)
    return _enrich_transfer(t, db)


@router.get("/{transfer_id}", response_model=TransferResponse)
def get_transfer(transfer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    check_view(t, _)
    return _enrich_transfer(t, db)


@router.put("/{transfer_id}/mto-review", response_model=TransferResponse)
def mto_review_endpoint(transfer_id: int, data: MTOReview, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "mto":
        raise HTTPException(status_code=403, detail="Only MTO can review transfers")
    t = transfer_service.mto_review(db, transfer_id, current_user.id, data.approved, data.notes)
    return _enrich_transfer(t, db)


@router.put("/{transfer_id}/donor-approval", response_model=TransferResponse)
def donor_approval_endpoint(transfer_id: int, data: PharmacistApproval, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("hospital_admin", "pharmacist"):
        raise HTTPException(status_code=403, detail="Only pharmacists can approve")
    t = transfer_service.donor_approval(db, transfer_id, current_user.id, data.approved, data.notes)
    return _enrich_transfer(t, db)


@router.put("/{transfer_id}/receiver-approval", response_model=TransferResponse)
def receiver_approval_endpoint(transfer_id: int, data: PharmacistApproval, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("hospital_admin", "pharmacist"):
        raise HTTPException(status_code=403, detail="Only pharmacists can approve")
    t = transfer_service.receiver_approval(db, transfer_id, current_user.id, data.approved, data.notes)
    return _enrich_transfer(t, db)


@router.put("/{transfer_id}/logistics", response_model=TransferResponse)
def update_logistics(transfer_id: int, data: LogisticsUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "logistics":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if t.status not in ('ready_for_dispatch','dispatched','in_transit') or not t.qr_code_token or not t.mto_id:
        raise HTTPException(400, 'Final approval required and shipment must still be active')
    t.logistics_personnel_id = current_user.id
    transfer_service.log_action(db,current_user.id,'LOGISTICS_DETAILS','transfer',t.id,data.model_dump_json())
    for f, v in data.model_dump(exclude_unset=True).items():
        setattr(t, f, v)
    db.commit()
    db.refresh(t)
    return _enrich_transfer(t, db)


@router.put("/{transfer_id}/status", response_model=TransferResponse)
def update_status(transfer_id: int, data: TransferStatusUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if data.status != "cancelled":
        raise HTTPException(400, "Use the dedicated shipment or approval action with its required fields")
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
    t = transfer_service.confirm_receipt(db,t,current_user,data)
    return _enrich_transfer(t, db)


@router.get("/{transfer_id}/qr-code")
def get_qr_code(transfer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    check_view(t, _)
    if not t.qr_code_token:
        raise HTTPException(status_code=400, detail="QR code not yet generated (transfer must be approved)")
    img_bytes = transfer_service.generate_qr_image_bytes(t.qr_code_token)
    return Response(content=img_bytes, media_type="image/png")


@router.get("/verify/{token}", response_model=TransferResponse)
def verify_by_qr_token(token: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = transfer_service.verify_by_qr(db, token)
    if not t:
        raise HTTPException(status_code=404, detail="Invalid or expired QR token")
    check_view(t, _)
    return _enrich_transfer(t, db)


@router.get("/{transfer_id}/audit-logs")
def get_transfer_audit_logs(transfer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    check_view(transfer_service.get_transfer(db,transfer_id), _)
    logs = db.query(AuditLog).filter(
        AuditLog.entity_type == "transfer",
        AuditLog.entity_id == transfer_id,
    ).order_by(AuditLog.created_at.asc()).all()
    res = []
    for l in logs:
        u = db.query(User).filter(User.id == l.user_id).first() if l.user_id else None
        res.append({
            "id": l.id,
            "action": l.action,
            "details": l.details,
            "user_id": l.user_id,
            "user_name": u.full_name if u else (u.username if u else "System"),
            "created_at": l.created_at.replace(tzinfo=timezone.utc).isoformat() if l.created_at else None,
        })
    return res


def check_view(t, user):
    if user.role in ('pharmacist','hospital_admin') and user.hospital_id not in (t.donor_hospital_id,t.receiver_hospital_id):
        raise HTTPException(403, 'Transfer belongs to another facility')

class Followup(BaseModel):
    action: str
    notes: str

@router.put('/{transfer_id}/mto-followup')
def followup(transfer_id: int, data: Followup, db: Session=Depends(get_db), user=Depends(get_current_user)):
    if user.role != 'mto': raise HTTPException(403, 'Only MTO can review')
    t = transfer_service.get_transfer(db, transfer_id)
    if not data.notes.strip(): raise HTTPException(400,'Review notes required')
    if data.action not in ('documents','correction'): raise HTTPException(400,'Invalid review action')
    target = 'mto_requested_documents' if data.action == 'documents' else 'donor_review'
    transfer_service.move(db,t,target,user.id,data.notes)
    if target == 'donor_review': transfer_service.release_stock(db,t.batch_id,t.quantity)
    t.mto_notes=data.notes
    for recipient in db.query(User).filter(User.hospital_id.in_([t.donor_hospital_id,t.receiver_hospital_id])).all():
        db.add(Notification(user_id=recipient.id,title="MTO review follow-up",message=data.notes,link=f"/transfers/{t.id}"))
    db.commit(); return _enrich_transfer(t,db)

@router.post('/{transfer_id}/documents')
async def transfer_document(transfer_id: int, file: UploadFile=File(...), notes: str=Form(...), db: Session=Depends(get_db), user=Depends(get_current_user)):
    t=transfer_service.get_transfer(db,transfer_id)
    transfer_service.authorize_facility(db,user,t.donor_hospital_id)
    if t.status != 'mto_requested_documents': raise HTTPException(400,'MTO has not requested documents')
    content,mime=await read_document(file)
    d=VerificationDocument(id=str(uuid.uuid4()),owner_id=user.id,kind='transfer',name=file.filename or 'document',mime=mime,content=content)
    db.add(d)
    r=db.query(MedicineRequest).filter_by(transfer_id=t.id).first()
    r.data={**r.data,'supporting_documents':r.data.get('supporting_documents',[])+[d.id]}
    transfer_service.move(db,t,'awaiting_mto_review',user.id,notes)
    db.commit(); return _enrich_transfer(t,db)

from datetime import datetime, timezone
class ShipmentUpdate(BaseModel):
    status: str
    timestamp: datetime
    transporter: str = ''
    tracking_reference: str = ''
    receiving_person: str = ''
    remarks: str

@router.put('/{transfer_id}/shipment', response_model=TransferResponse)
def shipment(transfer_id: int, data: ShipmentUpdate, db: Session=Depends(get_db), user=Depends(get_current_user)):
    if user.role != 'logistics': raise HTTPException(403,'Only logistics personnel can update shipments')
    t=transfer_service.get_transfer(db,transfer_id)
    if data.status not in ('dispatched','in_transit','delivered') or not data.remarks.strip(): raise HTTPException(400,'Status and remarks required')
    transfer_service.validate_transition(t.status,data.status)
    event_time=data.timestamp.replace(tzinfo=timezone.utc) if data.timestamp.tzinfo is None else data.timestamp
    if event_time > datetime.now(timezone.utc): raise HTTPException(400,'Event timestamp cannot be in the future')
    previous=t.dispatch_date if data.status!='dispatched' else None
    if previous and event_time < previous.replace(tzinfo=timezone.utc): raise HTTPException(400,'Event precedes dispatch')
    if data.status=='dispatched':
        if not data.transporter.strip() or not data.tracking_reference.strip(): raise HTTPException(400,'Transporter and tracking reference required')
        t.dispatch_date=data.timestamp
    if data.status=='delivered':
        if not data.receiving_person.strip(): raise HTTPException(400,'Receiving person required')
        t.actual_delivery=data.timestamp
    t.logistics_personnel_id=user.id
    import json
    details={**data.model_dump(mode='json'),'personnel':user.full_name,'user_id':user.id}
    t.delivery_notes=json.dumps(details)
    transfer_service.log_action(db,user.id,'SHIPMENT_UPDATE','transfer',t.id,t.delivery_notes)
    result=transfer_service.update_transfer_status(db,t.id,data.status,user.id,t.delivery_notes)
    return _enrich_transfer(result,db)

from app.api.routes.requests import Offer
from datetime import date

@router.put('/{transfer_id}/correction', response_model=TransferResponse)
def correct_offer(transfer_id: int, data: Offer, db: Session=Depends(get_db), user=Depends(get_current_user)):
    t=transfer_service.get_transfer(db,transfer_id)
    transfer_service.authorize_facility(db,user,t.donor_hospital_id)
    if t.status != 'donor_review': raise HTTPException(400,'MTO must return the offer for correction first')
    request=db.query(MedicineRequest).filter_by(transfer_id=t.id).first()
    batch=db.get(MedicineBatch,data.batch_id)
    if not batch or batch.hospital_id != user.hospital_id: raise HTTPException(403,'Select a batch belonging to your facility')
    medicine=db.get(Medicine,batch.medicine_id)
    for key,value in [('medicine_name',medicine.name),('active_ingredient',medicine.active_ingredient),('strength',medicine.strength),('dosage_form',medicine.dosage_form)]:
        if (value or '').strip().casefold()!=request.data[key].strip().casefold(): raise HTTPException(400,'Medicine specification mismatch')
    if data.quantity > request.data['quantity'] or data.expiry_date != batch.expiry_date or batch.expiry_date <= date.fromisoformat(request.data['required_delivery_date']): raise HTTPException(400,'Quantity or expiry is invalid for this request')
    transfer_service.move(db,t,'donor_approved',user.id,data.remarks)
    transfer_service.reserve_stock(db,batch.id,data.quantity)
    t.batch_id=batch.id;t.medicine_id=batch.medicine_id;t.quantity=data.quantity
    t.donor_notes=data.remarks;t.donor_pharmacist_id=user.id;t.donor_approval_at=datetime.now(timezone.utc)
    request.data={**request.data,'offer':data.model_dump(mode='json')}
    transfer_service.move(db,t,'awaiting_mto_review',user.id,'Corrected donor offer submitted')
    for recipient in db.query(User).filter((User.role=='mto')|(User.hospital_id==t.receiver_hospital_id)).all():
        db.add(Notification(user_id=recipient.id,title='Corrected donor offer',message=f'Transfer {t.id} awaits MTO review',link=f'/transfers/{t.id}'))
    db.commit();return _enrich_transfer(t,db)
