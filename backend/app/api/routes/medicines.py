"""Medicine and batch management routes."""
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.core.security import get_current_user
from app.models.medicine import Medicine, MedicineBatch
from app.models.hospital import Hospital
from app.schemas.medicine import (
    MedicineCreate, MedicineUpdate, MedicineResponse,
    BatchCreate, BatchUpdate, BatchResponse,
)
from app.services.inventory_service import categorize_batch_status, update_batch_statuses

router = APIRouter(prefix="/medicines", tags=["Medicines"])


# ── Medicine CRUD ─────────────────────────────────────────────────────────────

@router.get("", response_model=List[MedicineResponse])
def list_medicines(skip: int = 0, limit: int = 200, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Medicine).offset(skip).limit(limit).all()


@router.post("", response_model=MedicineResponse, status_code=201)
def create_medicine(data: MedicineCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "hospital_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    med = Medicine(**data.model_dump())
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


@router.get("/{medicine_id}", response_model=MedicineResponse)
def get_medicine(medicine_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return med


@router.put("/{medicine_id}", response_model=MedicineResponse)
def update_medicine(medicine_id: int, data: MedicineUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "hospital_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    for f, v in data.model_dump(exclude_unset=True).items():
        setattr(med, f, v)
    db.commit()
    db.refresh(med)
    return med


# ── Batch CRUD ────────────────────────────────────────────────────────────────

@router.get("/batches/all", response_model=List[BatchResponse])
def list_batches(
    hospital_id: Optional[int] = Query(None),
    medicine_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    update_batch_statuses(db)
    q = db.query(MedicineBatch)
    if hospital_id:
        q = q.filter(MedicineBatch.hospital_id == hospital_id)
    if medicine_id:
        q = q.filter(MedicineBatch.medicine_id == medicine_id)
    if status:
        q = q.filter(MedicineBatch.status == status)
    batches = q.offset(skip).limit(limit).all()
    result = []
    for b in batches:
        med = db.query(Medicine).filter(Medicine.id == b.medicine_id).first()
        hosp = db.query(Hospital).filter(Hospital.id == b.hospital_id).first()
        resp = BatchResponse.model_validate(b)
        resp.medicine_name = med.name if med else None
        resp.hospital_name = hosp.name if hosp else None
        result.append(resp)
    return result


@router.post("/batches", response_model=BatchResponse, status_code=201)
def create_batch(data: BatchCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "hospital_admin", "pharmacist"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    status = categorize_batch_status(data.expiry_date)
    batch = MedicineBatch(**data.model_dump(), status=status)
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/batches/{batch_id}", response_model=BatchResponse)
def get_batch(batch_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    b = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found")
    med = db.query(Medicine).filter(Medicine.id == b.medicine_id).first()
    hosp = db.query(Hospital).filter(Hospital.id == b.hospital_id).first()
    resp = BatchResponse.model_validate(b)
    resp.medicine_name = med.name if med else None
    resp.hospital_name = hosp.name if hosp else None
    return resp


@router.put("/batches/{batch_id}", response_model=BatchResponse)
def update_batch(batch_id: int, data: BatchUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("network_admin", "hospital_admin", "pharmacist"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    for f, v in data.model_dump(exclude_unset=True).items():
        setattr(batch, f, v)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/expiry-summary/stats")
def expiry_summary(db: Session = Depends(get_db), _=Depends(get_current_user)):
    update_batch_statuses(db)
    statuses = ["normal", "approaching_expiry", "critical", "expired", "quarantined", "recalled"]
    return {s: db.query(MedicineBatch).filter(MedicineBatch.status == s).count() for s in statuses}
