"""Inventory calculations: surplus, shortage, days of cover, expiry status."""
from datetime import date, timedelta
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.medicine import MedicineBatch
from app.models.consumption import ConsumptionRecord
from app.models.hospital import Hospital
from app.models.medicine import Medicine


SAFETY_STOCK_DAYS = 14      # 2-week safety stock
EXPIRY_WARNING_DAYS = 60    # approaching expiry threshold
EXPIRY_CRITICAL_DAYS = 30   # critical expiry threshold


def categorize_batch_status(expiry_date: date) -> str:
    """Return expiry status label for a batch based on its expiry date."""
    today = date.today()
    days_remaining = (expiry_date - today).days
    if days_remaining < 0:
        return "expired"
    elif days_remaining <= EXPIRY_CRITICAL_DAYS:
        return "critical"
    elif days_remaining <= EXPIRY_WARNING_DAYS:
        return "approaching_expiry"
    return "normal"


def update_batch_statuses(db: Session) -> None:
    """Recalculate and update status for all non-quarantined/recalled batches."""
    batches = db.query(MedicineBatch).filter(
        MedicineBatch.status.notin_(["quarantined", "recalled"])
    ).all()
    for batch in batches:
        new_status = categorize_batch_status(batch.expiry_date)
        batch.status = new_status
    db.commit()


def get_avg_daily_consumption(db: Session, hospital_id: int, medicine_id: int, days: int = 30) -> float:
    """Calculate average daily consumption over the past N days."""
    since = date.today() - timedelta(days=days)
    result = db.query(func.sum(ConsumptionRecord.quantity_consumed)).filter(
        ConsumptionRecord.hospital_id == hospital_id,
        ConsumptionRecord.medicine_id == medicine_id,
        ConsumptionRecord.date >= since,
    ).scalar()
    total = result or 0
    return total / days if days > 0 else 0.0


def calculate_days_of_cover(available_stock: int, avg_daily_consumption: float) -> float:
    """Days of Cover = Available Stock / Average Daily Consumption."""
    if avg_daily_consumption <= 0:
        return float("inf") if available_stock > 0 else 0.0
    return available_stock / avg_daily_consumption


def calculate_surplus(
    available: int,
    forecast_demand: float,
    safety_stock: float,
    committed: int,
) -> int:
    """Surplus = max(0, Available - Forecast Demand - Safety Stock - Committed)."""
    return max(0, int(available - forecast_demand - safety_stock - committed))


def calculate_shortage(required: float, available: int) -> int:
    """Shortage = max(0, Required - Available)."""
    return max(0, int(required - available))


def get_eligible_batches(db: Session, hospital_id: int, medicine_id: int) -> List[MedicineBatch]:
    """Return batches eligible for transfer (not expired/quarantined/recalled, >30d expiry remaining)."""
    cutoff = date.today() + timedelta(days=30)
    return db.query(MedicineBatch).filter(
        MedicineBatch.hospital_id == hospital_id,
        MedicineBatch.medicine_id == medicine_id,
        MedicineBatch.status.notin_(["expired", "quarantined", "recalled"]),
        MedicineBatch.expiry_date > cutoff,
        MedicineBatch.quantity > MedicineBatch.reserved_quantity,
    ).order_by(MedicineBatch.expiry_date.asc()).all()


def get_available_quantity(batch: MedicineBatch) -> int:
    """Available quantity = total quantity - reserved."""
    return max(0, batch.quantity - batch.reserved_quantity)


def get_surplus_hospitals(db: Session) -> List[dict]:
    """Find all hospital+medicine combinations with surplus."""
    results = []
    hospitals = db.query(Hospital).filter(Hospital.status == "active").all()
    medicines = db.query(Medicine).all()

    for hospital in hospitals:
        for medicine in medicines:
            batches = db.query(MedicineBatch).filter(
                MedicineBatch.hospital_id == hospital.id,
                MedicineBatch.medicine_id == medicine.id,
                MedicineBatch.status.notin_(["expired", "quarantined", "recalled"]),
            ).all()

            if not batches:
                continue

            available = sum(get_available_quantity(b) for b in batches)
            if available == 0:
                continue

            avg_daily = get_avg_daily_consumption(db, hospital.id, medicine.id)
            forecast_demand = avg_daily * 30
            safety_stock = avg_daily * SAFETY_STOCK_DAYS
            committed = sum(b.reserved_quantity for b in batches)
            surplus = calculate_surplus(available, forecast_demand, safety_stock, committed)
            days_of_cover = calculate_days_of_cover(available, avg_daily)

            if surplus > 0:
                results.append({
                    "hospital_id": hospital.id,
                    "hospital_name": hospital.name,
                    "medicine_id": medicine.id,
                    "medicine_name": medicine.name,
                    "available_stock": available,
                    "avg_daily_consumption": round(avg_daily, 2),
                    "days_of_cover": round(days_of_cover, 1),
                    "forecast_demand": round(forecast_demand, 1),
                    "safety_stock": round(safety_stock, 1),
                    "surplus": surplus,
                    "shortage": 0,
                    "reason": f"Stock covers {days_of_cover:.0f} days; surplus of {surplus} units above 30-day forecast + safety stock.",
                })
    return results


def get_shortage_hospitals(db: Session) -> List[dict]:
    """Find all hospital+medicine combinations with shortage."""
    results = []
    hospitals = db.query(Hospital).filter(Hospital.status == "active").all()
    medicines = db.query(Medicine).all()

    for hospital in hospitals:
        for medicine in medicines:
            avg_daily = get_avg_daily_consumption(db, hospital.id, medicine.id)
            if avg_daily == 0:
                continue

            batches = db.query(MedicineBatch).filter(
                MedicineBatch.hospital_id == hospital.id,
                MedicineBatch.medicine_id == medicine.id,
                MedicineBatch.status.notin_(["expired", "quarantined", "recalled"]),
            ).all()

            available = sum(get_available_quantity(b) for b in batches)
            required = avg_daily * 30 + avg_daily * SAFETY_STOCK_DAYS
            shortage = calculate_shortage(required, available)
            days_of_cover = calculate_days_of_cover(available, avg_daily)

            if shortage > 0:
                results.append({
                    "hospital_id": hospital.id,
                    "hospital_name": hospital.name,
                    "medicine_id": medicine.id,
                    "medicine_name": medicine.name,
                    "available_stock": available,
                    "avg_daily_consumption": round(avg_daily, 2),
                    "days_of_cover": round(days_of_cover, 1),
                    "forecast_demand": round(avg_daily * 30, 1),
                    "safety_stock": round(avg_daily * SAFETY_STOCK_DAYS, 1),
                    "surplus": 0,
                    "shortage": shortage,
                    "reason": f"Only {days_of_cover:.0f} days cover remaining; short by {shortage} units.",
                })
    return results
