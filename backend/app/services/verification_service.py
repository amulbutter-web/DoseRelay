from datetime import date
from fastapi import HTTPException
from app.models.verification import FacilityRegistration


def approved_facility(db, hospital_id):
    r = db.query(FacilityRegistration).filter_by(hospital_id=hospital_id).first()
    if not r:
        from app.models.hospital import Hospital
        h = db.query(Hospital).filter_by(id=hospital_id).first()
        if h and h.status == "active":
            return True
        raise HTTPException(403, "Facility not found or inactive")
    if r and r.registration_status == "REGISTRATION REJECTED":
        raise HTTPException(403, "Facility registration was rejected. Contact the administrator.")
    if r and r.nin_status in ("FACILITY DETAILS MISMATCH", "VERIFICATION FAILED"):
        raise HTTPException(403, "NIN verification: " + r.nin_status + ". Contact the administrator.")
    if r.nin_status != "NIN VERIFIED":
        raise HTTPException(
            403, "NIN verification is incomplete. Administrator review is required."
        )
    if r.registration_status != "REGISTRATION APPROVED":
        raise HTTPException(403, "Facility registration approval is pending.")
    if (
        r.licence_status != "PASSED"
        or (r.data and "licence_validity" in r.data and date.fromisoformat(r.data["licence_validity"]) < date.today())
    ):
        raise HTTPException(
            403,
            "Required Drug Licence checks have not passed or the licence has expired.",
        )
    return r


def check_account(db, user):
    if not user.is_active:
        raise HTTPException(403, "Account is inactive.")
    if user.role in ("pharmacist", "hospital_admin"):
        approved_facility(db, user.hospital_id)
    if user.role not in (
        "network_admin",
        "hospital_admin",
        "pharmacist",
        "mto",
        "logistics",
    ):
        raise HTTPException(403, "This account role is not supported.")
