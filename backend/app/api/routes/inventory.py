"""Inventory routes: surplus, shortages, expiry alerts."""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.core.security import get_current_user
from app.services.inventory_service import get_surplus_hospitals, get_shortage_hospitals, update_batch_statuses
from app.schemas.analytics import SurplusShortageItem

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/surplus", response_model=List[SurplusShortageItem])
def get_surplus(
    hospital_id: Optional[int] = Query(None, description="Filter surplus by hospital ID"),
    medicine_id: Optional[int] = Query(None, description="Filter surplus by medicine ID"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return get_surplus_hospitals(db, hospital_id=hospital_id, medicine_id=medicine_id)


@router.get("/shortages", response_model=List[SurplusShortageItem])
def get_shortages(
    hospital_id: Optional[int] = Query(None, description="Filter shortages by hospital ID"),
    medicine_id: Optional[int] = Query(None, description="Filter shortages by medicine ID"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return get_shortage_hospitals(db, hospital_id=hospital_id, medicine_id=medicine_id)


@router.get("/expiry-alerts")
def expiry_alerts(db: Session = Depends(get_db), _=Depends(get_current_user)):
    from datetime import date, timedelta
    from app.models.medicine import MedicineBatch, Medicine
    from app.models.hospital import Hospital

    update_batch_statuses(db)
    cutoff = date.today() + timedelta(days=60)
    batches = db.query(MedicineBatch).filter(
        MedicineBatch.expiry_date <= cutoff,
        MedicineBatch.status.notin_(["quarantined", "recalled"]),
    ).order_by(MedicineBatch.expiry_date.asc()).limit(100).all()

    result = []
    for b in batches:
        med = db.query(Medicine).filter(Medicine.id == b.medicine_id).first()
        hosp = db.query(Hospital).filter(Hospital.id == b.hospital_id).first()
        days_rem = (b.expiry_date - date.today()).days
        result.append({
            "batch_id": b.id,
            "batch_number": b.batch_number,
            "medicine_id": b.medicine_id,
            "medicine_name": med.name if med else "Unknown",
            "hospital_id": b.hospital_id,
            "hospital_name": hosp.name if hosp else "Unknown",
            "quantity": b.quantity,
            "expiry_date": b.expiry_date.isoformat(),
            "days_remaining": days_rem,
            "status": b.status,
        })
    return result


@router.post("/refresh-statuses")
def refresh_statuses(db: Session = Depends(get_db), _=Depends(get_current_user)):
    update_batch_statuses(db)
    return {"message": "Batch statuses refreshed", "status": "success"}
