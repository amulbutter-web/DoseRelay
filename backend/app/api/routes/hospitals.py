"""Hospital management routes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.base import get_db
from app.core.security import get_current_user
from app.models.hospital import Hospital
from app.models.medicine import MedicineBatch
from app.schemas.hospital import HospitalCreate, HospitalUpdate, HospitalResponse, HospitalWithStats

router = APIRouter(prefix="/hospitals", tags=["Hospitals"])


@router.get("", response_model=List[HospitalWithStats])
def list_hospitals(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Hospital)
    if status:
        q = q.filter(Hospital.status == status)
    hospitals = q.offset(skip).limit(limit).all()
    result = []
    for h in hospitals:
        batches = db.query(MedicineBatch).filter(MedicineBatch.hospital_id == h.id).all()
        expiry_alerts = sum(1 for b in batches if b.status in ("approaching_expiry", "critical", "expired"))
        result.append(HospitalWithStats(
            **HospitalResponse.model_validate(h).model_dump(),
            total_batches=len(batches),
            total_medicines=len(set(b.medicine_id for b in batches)),
            expiry_alert_count=expiry_alerts,
        ))
    return result


@router.post("", response_model=HospitalResponse, status_code=201)
def create_hospital(data: HospitalCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin",):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if db.query(Hospital).filter(Hospital.code == data.code).first():
        raise HTTPException(status_code=400, detail="Hospital code already exists")
    hospital = Hospital(**data.model_dump())
    db.add(hospital)
    db.commit()
    db.refresh(hospital)
    return hospital


@router.get("/{hospital_id}", response_model=HospitalWithStats)
def get_hospital(hospital_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    h = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found")
    batches = db.query(MedicineBatch).filter(MedicineBatch.hospital_id == h.id).all()
    expiry_alerts = sum(1 for b in batches if b.status in ("approaching_expiry", "critical", "expired"))
    return HospitalWithStats(
        **HospitalResponse.model_validate(h).model_dump(),
        total_batches=len(batches),
        total_medicines=len(set(b.medicine_id for b in batches)),
        expiry_alert_count=expiry_alerts,
    )


@router.put("/{hospital_id}", response_model=HospitalResponse)
def update_hospital(hospital_id: int, data: HospitalUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "hospital_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(hospital, field, value)
    db.commit()
    db.refresh(hospital)
    return hospital


@router.delete("/{hospital_id}", status_code=204)
def delete_hospital(hospital_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "network_admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    hospital.status = "inactive"
    db.commit()
