"""Forecasting routes."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.core.security import get_current_user
from app.models.forecast import DemandForecast
from app.models.hospital import Hospital
from app.models.medicine import Medicine
from app.schemas.forecast import ForecastRequest, ForecastResponse, ForecastSummary
from app.ai.forecasting import generate_forecast
from app.services.inventory_service import get_avg_daily_consumption, calculate_days_of_cover

router = APIRouter(prefix="/forecasts", tags=["Forecasts"])


@router.post("/generate", response_model=List[ForecastResponse])
def generate_demand_forecast(data: ForecastRequest, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not db.query(Hospital).filter(Hospital.id == data.hospital_id).first():
        raise HTTPException(status_code=404, detail="Hospital not found")
    if not db.query(Medicine).filter(Medicine.id == data.medicine_id).first():
        raise HTTPException(status_code=404, detail="Medicine not found")
    forecasts = generate_forecast(db, data.hospital_id, data.medicine_id, data.days_ahead)
    return [ForecastResponse.model_validate(f) for f in forecasts]


@router.get("/summary/all", response_model=List[ForecastSummary])
def forecast_summary_all(db: Session = Depends(get_db), _=Depends(get_current_user)):
    from app.models.medicine import MedicineBatch
    from app.services.inventory_service import get_available_quantity

    hospitals = db.query(Hospital).filter(Hospital.status == "active").all()
    medicines = db.query(Medicine).all()
    results = []

    for h in hospitals:
        for m in medicines:
            avg = get_avg_daily_consumption(db, h.id, m.id)
            if avg == 0:
                continue
            batches = db.query(MedicineBatch).filter(
                MedicineBatch.hospital_id == h.id,
                MedicineBatch.medicine_id == m.id,
                MedicineBatch.status.notin_(["expired", "quarantined", "recalled"]),
            ).all()
            current_stock = sum(get_available_quantity(b) for b in batches)
            days_cover = calculate_days_of_cover(current_stock, avg)
            forecast_30 = avg * 30

            if days_cover < 7:
                risk = "critical"
            elif days_cover < 14:
                risk = "high"
            elif days_cover < 30:
                risk = "medium"
            else:
                risk = "low"

            results.append(ForecastSummary(
                hospital_id=h.id,
                hospital_name=h.name,
                medicine_id=m.id,
                medicine_name=m.name,
                avg_daily_consumption=round(avg, 2),
                forecasted_30d_demand=round(forecast_30, 1),
                current_stock=current_stock,
                days_of_cover=round(days_cover, 1),
                stockout_risk=risk,
                model_used="consumption_average",
            ))
    return results


@router.get("/{hospital_id}/{medicine_id}", response_model=List[ForecastResponse])
def get_forecast(hospital_id: int, medicine_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    from datetime import date
    forecasts = db.query(DemandForecast).filter(
        DemandForecast.hospital_id == hospital_id,
        DemandForecast.medicine_id == medicine_id,
        DemandForecast.forecast_date >= date.today(),
    ).order_by(DemandForecast.forecast_date.asc()).all()
    return forecasts
