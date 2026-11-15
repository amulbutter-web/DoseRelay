"""Manual verification against official records. No simulated government API."""

import json, re, uuid
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.base import get_db
from app.core.security import get_current_user, get_password_hash, role_required
from app.models.user import User
from app.models.hospital import Hospital
from app.models.verification import FacilityRegistration, VerificationDocument
from app.services.transfer_service import log_action

router = APIRouter(prefix="/registration", tags=["Facility verification"])
admin = role_required(["network_admin"])


async def read_document(file):
    data = await file.read(5 * 1024 * 1024 + 1)
    if not data or len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Documents must be between 1 byte and 5 MB.")
    mime = (
        "application/pdf"
        if data.startswith(b"%PDF-")
        else (
            "image/png"
            if data.startswith(b"\x89PNG\r\n\x1a\n")
            else "image/jpeg" if data.startswith(b"\xff\xd8\xff") else None
        )
    )
    if not mime:
        raise HTTPException(400, "Upload PDF, PNG or JPEG documents.")
    return data, mime


class Signup(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    facility_type: str = Field(pattern="^(pharmacy|hospital)$")
    address: str = Field(min_length=5)
    state: str = Field(min_length=2)
    district: str = Field(min_length=2)
    city: str = Field(min_length=2)
    pin_code: str = Field(pattern=r"^[0-9]{6}$")
    phone: str = Field(min_length=10, max_length=20)
    email: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    nin: str = Field(pattern=r"^[0-9]{10}$")
    representative: str = Field(min_length=2)
    pharmacist_name: str = ""
    pharmacist_registration: str = ""
    contact_information: str = Field(min_length=5)
    licence_number: str = Field(min_length=2)
    licence_type: str = Field(min_length=2)
    issuing_authority: str = Field(min_length=2)
    licence_validity: date
    password: str = Field(min_length=12, max_length=72)
    confirm_password: str


@router.get("/nin-status")
def nin_status(nin: str = "", db: Session = Depends(get_db)):
    if not nin:
        return {"status": "NIN NOT ENTERED"}
    if not re.fullmatch(r"[0-9]{10}", nin):
        return {"status": "INVALID NIN FORMAT"}
    if db.query(FacilityRegistration).filter_by(nin=nin).first():
        raise HTTPException(409, "NIN already registered")
    return {
        "status": "VERIFICATION PENDING",
        "method": "Manual official-record review; format validation is not verification.",
    }


@router.post("/signup", status_code=201)
async def signup(
    payload: str = Form(...),
    nin_document: UploadFile = File(...),
    licence_document: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        d = Signup.model_validate_json(payload)
    except Exception as e:
        raise HTTPException(422, "Invalid signup fields: " + str(e))
    if d.password != d.confirm_password:
        raise HTTPException(400, "Passwords do not match")
    if d.facility_type == "pharmacy" and (
        not d.pharmacist_name or not d.pharmacist_registration
    ):
        raise HTTPException(
            400, "Pharmacist name and registration are required for pharmacies"
        )
    if d.licence_validity < date.today():
        raise HTTPException(400, "Drug Licence has expired")
    nin_data, nin_mime = await read_document(nin_document)
    lic_data, lic_mime = await read_document(licence_document)
    try:
        h = Hospital(
            name=d.name,
            code="FAC-" + uuid.uuid4().hex[:16],
            address=d.address,
            city=d.city,
            state=d.state,
            phone=d.phone,
            email=d.email.lower(),
            hospital_type=d.facility_type,
        )
        db.add(h)
        db.flush()
        u = User(
            email=d.email.lower(),
            username=d.email.lower(),
            full_name=d.representative,
            role="pharmacist" if d.facility_type == "pharmacy" else "hospital_admin",
            hospital_id=h.id,
            hashed_password=get_password_hash(d.password),
        )
        db.add(u)
        db.flush()
        details = d.model_dump(mode="json", exclude={"password", "confirm_password"})
        details["submitted_at"] = datetime.now(timezone.utc).isoformat()
        details["method"] = "Manual official-record review"
        for kind, file, content, mime in [
            ("nin", nin_document, nin_data, nin_mime),
            ("licence", licence_document, lic_data, lic_mime),
        ]:
            doc = VerificationDocument(
                id=str(uuid.uuid4()),
                owner_id=u.id,
                kind=kind,
                name=file.filename or kind,
                mime=mime,
                content=content,
            )
            db.add(doc)
            details[kind + "_document_id"] = doc.id
        r = FacilityRegistration(hospital_id=h.id, nin=d.nin, data=details)
        db.add(r)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "NIN, email or username already registered")
    return {
        "status": "VERIFICATION PENDING",
        "message": "Submitted for manual NIN and separate Drug Licence review. Login is blocked until approval.",
    }


@router.get("")
def registrations(db: Session = Depends(get_db), user=Depends(admin)):
    return db.query(FacilityRegistration).all()


class Review(BaseModel):
    nin_status: str
    licence_status: str
    registration_status: str
    official_name: str = ""
    official_address: str = ""
    official_nin: str = ""
    official_reference: str = ""
    notes: str = Field(min_length=5)


@router.put("/{registration_id}/review")
def review(
    registration_id: int,
    data: Review,
    db: Session = Depends(get_db),
    user=Depends(admin),
):
    r = db.get(FacilityRegistration, registration_id)
    if not r:
        raise HTTPException(404, "Registration not found")
    if (
        data.nin_status
        not in [
            "VERIFICATION PENDING",
            "FACILITY DETAILS MISMATCH",
            "VERIFICATION FAILED",
            "NIN VERIFIED",
        ]
        or data.licence_status not in ["PENDING", "PASSED", "FAILED"]
        or data.registration_status
        not in [
            "VERIFICATION PENDING",
            "REGISTRATION APPROVED",
            "REGISTRATION REJECTED",
        ]
    ):
        raise HTTPException(400, "Invalid verification status")
    normalize = lambda s: " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower()).split())
    if data.nin_status == "NIN VERIFIED":
        if (
            not data.official_reference
            or data.official_nin != r.nin
            or normalize(data.official_name) != normalize(r.data["name"])
            or normalize(data.official_address) != normalize(r.data["address"])
        ):
            raise HTTPException(
                400,
                "Official NIN, facility name, address and record reference must match; record a mismatch otherwise.",
            )
    if data.registration_status == "REGISTRATION APPROVED" and (
        data.nin_status != "NIN VERIFIED"
        or data.licence_status != "PASSED"
        or date.fromisoformat(r.data["licence_validity"]) < date.today()
    ):
        raise HTTPException(
            400,
            "Approval requires verified NIN and a separately checked valid Drug Licence",
        )
    r.nin_status, r.licence_status, r.registration_status = (
        data.nin_status,
        data.licence_status,
        data.registration_status,
    )
    r.data = {
        **r.data,
        "review": {
            **data.model_dump(),
            "reviewer_id": user.id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }
    log_action(
        db,
        user.id,
        "FACILITY_REVIEW",
        "registration",
        r.id,
        json.dumps(r.data["review"]),
    )
    db.commit()
    db.refresh(r)
    return r


@router.get("/documents/{document_id}")
def document(
    document_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    d = db.get(VerificationDocument, document_id)
    if not d:
        raise HTTPException(404, "Document not found")
    if user.role not in ("network_admin", "mto") and user.id != d.owner_id:
        raise HTTPException(403, "Access denied")
    return Response(
        d.content,
        media_type=d.mime,
        headers={
            "Content-Disposition": 'attachment; filename="verification-document"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/existing", status_code=201)
async def submit_existing(
    payload: str = Form(...),
    hospital_id: int = Form(...),
    nin_document: UploadFile = File(...),
    licence_document: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_user=Depends(admin),
):
    """Administrator attaches verification to an existing facility without replacing it."""
    try:
        raw = json.loads(payload)
        d = Signup.model_validate(
            {
                **raw,
                "password": "validation-only-placeholder",
                "confirm_password": "validation-only-placeholder",
            }
        )
    except Exception as e:
        raise HTTPException(422, "Invalid facility details: " + str(e))
    h = db.get(Hospital, hospital_id)
    owner = db.query(User).filter(User.hospital_id == hospital_id).first()
    if not h or not owner:
        raise HTTPException(404, "Existing facility with an account required")
    if (
        h.name.strip().casefold() != d.name.strip().casefold()
        or h.address.strip().casefold() != d.address.strip().casefold()
    ):
        raise HTTPException(
            400, "Name and address must match the existing facility record"
        )
    details = d.model_dump(mode="json", exclude={"password", "confirm_password"})
    details["submitted_at"] = datetime.now(timezone.utc).isoformat()
    details["method"] = "Manual official-record review"
    for kind, file in [("nin", nin_document), ("licence", licence_document)]:
        content, mime = await read_document(file)
        doc = VerificationDocument(
            id=str(uuid.uuid4()),
            owner_id=owner.id,
            kind=kind,
            name=file.filename or kind,
            mime=mime,
            content=content,
        )
        db.add(doc)
        details[kind + "_document_id"] = doc.id
    db.add(FacilityRegistration(hospital_id=h.id, nin=d.nin, data=details))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "NIN or facility verification is already registered")
    return {
        "message": "Existing facility submitted for manual verification. Review it below."
    }
