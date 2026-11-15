"""Receiver requests and donor offers, before final MTO authorization."""

import uuid
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.core.security import get_current_user
from app.models.verification import MedicineRequest, FacilityRegistration
from app.models.medicine import Medicine, MedicineBatch
from app.models.transfer import Transfer
from app.models.user import User
from app.models.audit import Notification
from app.services.verification_service import approved_facility
from app.services import transfer_service as service

router = APIRouter(prefix="/requests", tags=["Medicine requests"])


def facility(db, u):
    if u.role not in ("pharmacist", "hospital_admin"):
        raise HTTPException(403, "An approved facility account is required")
    return approved_facility(db, u.hospital_id)


def notify(db, users, title, message, link="/transfers"):
    for u in users:
        db.add(Notification(user_id=u.id, title=title, message=message, link=link))


class RequestData(BaseModel):
    medicine_name: str = Field(min_length=2)
    active_ingredient: str = Field(min_length=2)
    strength: str = Field(min_length=1)
    dosage_form: str = Field(min_length=2)
    quantity: int = Field(gt=0)
    required_delivery_date: date
    storage_capability: str = Field(min_length=2)
    reason: str = Field(min_length=5)
    additional_information: str = ""


@router.post("", status_code=201)
def create(
    data: RequestData, db: Session = Depends(get_db), u=Depends(get_current_user)
):
    facility(db, u)
    if data.required_delivery_date < date.today():
        raise HTTPException(400, "Delivery date cannot be in the past")
    r = MedicineRequest(
        id=str(uuid.uuid4()),
        receiver_id=u.hospital_id,
        status="open_awaiting_donor",
        data={
            **data.model_dump(mode="json"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": u.id,
        },
    )
    db.add(r)
    db.flush()
    recipients = (
        db.query(User)
        .join(
            FacilityRegistration, User.hospital_id == FacilityRegistration.hospital_id
        )
        .filter(
            User.is_active == True,
            User.hospital_id != u.hospital_id,
            FacilityRegistration.registration_status == "REGISTRATION APPROVED",
            FacilityRegistration.nin_status == "NIN VERIFIED",
            FacilityRegistration.licence_status == "PASSED",
        )
        .all()
    )
    eligible_facilities = {
        b.hospital_id
        for b in db.query(MedicineBatch)
        .join(Medicine)
        .filter(
            Medicine.name == data.medicine_name,
            Medicine.active_ingredient == data.active_ingredient,
            Medicine.strength == data.strength,
            Medicine.dosage_form == data.dosage_form,
            MedicineBatch.expiry_date > data.required_delivery_date,
            MedicineBatch.status.in_(["normal", "approaching_expiry", "critical"]),
            MedicineBatch.quantity > MedicineBatch.reserved_quantity,
        )
        .all()
    }
    recipients = [
        recipient
        for recipient in recipients
        if recipient.hospital_id in eligible_facilities
    ]
    notify(
        db,
        recipients,
        "Medicine request open",
        f"{r.id}: {data.medicine_name}, {data.quantity} units",
    )
    db.commit()
    db.refresh(r)
    return r


@router.get("")
def listing(db: Session = Depends(get_db), u=Depends(get_current_user)):
    return db.query(MedicineRequest).all()


class Offer(BaseModel):
    batch_id: int
    quantity: int = Field(gt=0)
    expiry_date: date
    storage_conditions: str = Field(min_length=2)
    remarks: str = ""


@router.post("/{request_id}/offer")
def offer(
    request_id: str,
    data: Offer,
    db: Session = Depends(get_db),
    u=Depends(get_current_user),
):
    facility(db, u)
    r = db.query(MedicineRequest).filter_by(id=request_id).with_for_update().first()
    if not r:
        raise HTTPException(404, "Request not found")
    if (
        r.status not in ("open_awaiting_donor", "donor_review", "donor_rejected")
        or r.transfer_id
    ):
        raise HTTPException(409, "Request already allocated")
    if r.receiver_id == u.hospital_id:
        raise HTTPException(400, "Donor and receiver must differ")
    approved_facility(db, r.receiver_id)
    b = db.get(MedicineBatch, data.batch_id)
    if not b or b.hospital_id != u.hospital_id:
        raise HTTPException(403, "Batch does not belong to your facility")
    m = db.get(Medicine, b.medicine_id)
    for field, actual in [
        ("medicine_name", m.name),
        ("active_ingredient", m.active_ingredient),
        ("strength", m.strength),
        ("dosage_form", m.dosage_form),
    ]:
        if (actual or "").strip().casefold() != r.data[field].strip().casefold():
            raise HTTPException(400, "Medicine specification mismatch: " + field)
    if data.quantity > r.data["quantity"] or data.expiry_date != b.expiry_date:
        raise HTTPException(400, "Offered quantity or expiry does not match")
    if b.expiry_date <= date.fromisoformat(r.data["required_delivery_date"]):
        raise HTTPException(400, "Batch must remain valid through expected delivery")
    # Claim request atomically on SQLite as well as PostgreSQL.
    claimed = (
        db.query(MedicineRequest)
        .filter(
            MedicineRequest.id == r.id,
            MedicineRequest.transfer_id == None,
            MedicineRequest.status == r.status,
        )
        .update({"status": "donor_approved"}, synchronize_session=False)
    )
    if claimed != 1:
        raise HTTPException(409, "Request was allocated concurrently")
    service.reserve_stock(db, b.id, data.quantity)
    t = Transfer(
        donor_hospital_id=u.hospital_id,
        receiver_hospital_id=r.receiver_id,
        medicine_id=b.medicine_id,
        batch_id=b.id,
        quantity=data.quantity,
        status="awaiting_mto_review",
        donor_pharmacist_id=u.id,
        donor_approval_at=datetime.now(timezone.utc),
        donor_notes=data.remarks,
        estimated_delivery=datetime.combine(
            date.fromisoformat(r.data["required_delivery_date"]), datetime.max.time()
        ),
    )
    db.add(t)
    db.flush()
    r.transfer_id = t.id
    r.status = "awaiting_mto_review"
    r.data = {**r.data, "offer": data.model_dump(mode="json")}
    service.log_action(
        db,
        r.data["created_by"],
        "REQUEST_CREATED",
        "transfer",
        t.id,
        "Receiver request submitted at " + r.data["created_at"],
    )
    service.log_action(db, u.id, "DONOR_APPROVED", "transfer", t.id, data.remarks)
    service.log_action(
        db,
        u.id,
        "AWAITING_MTO_REVIEW",
        "transfer",
        t.id,
        "Donor approval is not final authorization",
    )
    notify(
        db,
        db.query(User)
        .filter((User.hospital_id == r.receiver_id) | (User.role == "mto"))
        .all(),
        "Donor approved",
        f"Request {r.id} awaits MTO review",
        f"/transfers/{t.id}",
    )
    db.commit()
    return {"transfer_id": t.id, "request_id": r.id, "status": t.status}


class Note(BaseModel):
    notes: str = Field(min_length=5)


@router.post("/{request_id}/reject")
def reject(
    request_id: str,
    data: Note,
    db: Session = Depends(get_db),
    u=Depends(get_current_user),
):
    facility(db, u)
    r = db.get(MedicineRequest, request_id)
    if not r or r.transfer_id:
        raise HTTPException(409, "Request unavailable")
    if r.receiver_id == u.hospital_id:
        raise HTTPException(403, "Receiver cannot reject as donor")
    r.data = {
        **r.data,
        "donor_rejections": r.data.get("donor_rejections", [])
        + [
            {
                "facility_id": u.hospital_id,
                "notes": data.notes,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }
    # A donor rejection must not prevent other eligible donors offering.
    r.status = "donor_rejected"
    db.commit()
    db.refresh(r)
    return r


@router.get("/eligible-batches")
def eligible_batches(db: Session = Depends(get_db), u=Depends(get_current_user)):
    facility(db, u)
    return [
        dict(
            id=b.id,
            hospital_id=b.hospital_id,
            batch_number=b.batch_number,
            medicine_name=db.get(Medicine, b.medicine_id).name,
            quantity=b.quantity,
            reserved_quantity=b.reserved_quantity,
            expiry_date=b.expiry_date,
        )
        for b in db.query(MedicineBatch)
        .filter(
            MedicineBatch.hospital_id == u.hospital_id,
            MedicineBatch.expiry_date > date.today(),
            MedicineBatch.status.in_(["normal", "approaching_expiry", "critical"]),
            MedicineBatch.quantity > MedicineBatch.reserved_quantity,
        )
        .all()
    ]
