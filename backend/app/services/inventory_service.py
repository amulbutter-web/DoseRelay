"""Inventory calculations: surplus, shortage, days of cover, expiry status."""
from datetime import date, timedelta
from typing import List, Tuple, Optional, Dict, Any
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
        MedicineBatch.status.notin_(["quarantined", "recalled", "damaged"])
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
    """Days of Cover = Available Stock / Average Daily Consumption (safely handles zero consumption)."""
    if avg_daily_consumption <= 0:
        return float("inf") if available_stock > 0 else 0.0
    return available_stock / avg_daily_consumption


def calculate_surplus(
    available: int,
    forecast_demand: float,
    safety_stock: float,
    committed: int,
) -> int:
    """Surplus = max(0, Available Stock - Forecast Demand - Safety Stock - Committed Stock)."""
    return max(0, int(available - forecast_demand - safety_stock - committed))


def calculate_shortage(required: float, available: int) -> int:
    """Shortage = max(0, Required Stock - Available Stock)."""
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
    """Available unreserved quantity = total quantity - reserved."""
    return max(0, batch.quantity - batch.reserved_quantity)


def get_surplus_hospitals(
    db: Session,
    hospital_id: Optional[int] = None,
    medicine_id: Optional[int] = None,
) -> List[dict]:
    """
    Find all hospital+medicine combinations with surplus.
    Surplus = max(0, Available Stock - Forecast Demand - Safety Stock - Committed Stock).
    """
    results = []
    hosp_query = db.query(Hospital).filter(Hospital.status == "active")
    if hospital_id:
        hosp_query = hosp_query.filter(Hospital.id == hospital_id)
    hospitals = hosp_query.all()

    med_query = db.query(Medicine)
    if medicine_id:
        med_query = med_query.filter(Medicine.id == medicine_id)
    medicines = med_query.all()

    today = date.today()
    warning_cutoff = today + timedelta(days=EXPIRY_WARNING_DAYS)

    for hospital in hospitals:
        for medicine in medicines:
            batches = db.query(MedicineBatch).filter(
                MedicineBatch.hospital_id == hospital.id,
                MedicineBatch.medicine_id == medicine.id,
                MedicineBatch.status.notin_(["expired", "quarantined", "recalled"]),
                MedicineBatch.expiry_date > today,
            ).order_by(MedicineBatch.expiry_date.asc()).all()

            if not batches:
                continue

            available_stock = sum(b.quantity for b in batches)
            committed_stock = sum(min(b.quantity, b.reserved_quantity) for b in batches)

            if available_stock == 0:
                continue

            avg_daily = get_avg_daily_consumption(db, hospital.id, medicine.id)
            forecast_demand = round(avg_daily * 30, 1)
            safety_stock = round(avg_daily * SAFETY_STOCK_DAYS, 1)

            surplus = calculate_surplus(available_stock, forecast_demand, safety_stock, committed_stock)
            days_of_cover = calculate_days_of_cover(available_stock, avg_daily)

            if surplus > 0:
                # Near expiry quantity (within 60 days)
                near_expiry_batches = [b for b in batches if b.expiry_date <= warning_cutoff]
                near_expiry_qty = sum(b.quantity for b in near_expiry_batches)
                earliest_expiry = batches[0].expiry_date if batches else None
                days_to_expiry = (earliest_expiry - today).days if earliest_expiry else 9999

                # Urgency level
                if days_to_expiry <= EXPIRY_CRITICAL_DAYS:
                    urgency = "critical"
                elif days_to_expiry <= EXPIRY_WARNING_DAYS:
                    urgency = "high"
                elif surplus >= 500:
                    urgency = "medium"
                else:
                    urgency = "low"

                days_cover_display = f"{days_of_cover:.0f}" if days_of_cover != float("inf") else "∞"
                reason = (
                    f"Stock covers {days_cover_display} days; surplus of {surplus} units above "
                    f"30d forecast ({forecast_demand:.0f}) + safety stock ({safety_stock:.0f})."
                )
                if near_expiry_qty > 0:
                    reason += f" {near_expiry_qty} units expiring within 60 days."

                results.append({
                    "hospital_id": hospital.id,
                    "hospital_name": hospital.name,
                    "city": hospital.city,
                    "state": hospital.state,
                    "medicine_id": medicine.id,
                    "medicine_name": medicine.name,
                    "available_stock": available_stock,
                    "committed_stock": committed_stock,
                    "avg_daily_consumption": round(avg_daily, 2),
                    "days_of_cover": round(days_of_cover, 1) if days_of_cover != float("inf") else float("inf"),
                    "forecast_demand": forecast_demand,
                    "safety_stock": safety_stock,
                    "surplus": surplus,
                    "shortage": 0,
                    "near_expiry_quantity": near_expiry_qty,
                    "expiry_date": earliest_expiry.isoformat() if earliest_expiry else None,
                    "urgency": urgency,
                    "reason": reason,
                    "suggested_donors": [],
                })
    return results


def get_shortage_hospitals(
    db: Session,
    hospital_id: Optional[int] = None,
    medicine_id: Optional[int] = None,
) -> List[dict]:
    """
    Find all hospital+medicine combinations with shortage.
    Shortage = max(0, Required Stock - Available Stock).
    Populates suggested donor hospitals having surplus for that medicine.
    """
    results = []
    hosp_query = db.query(Hospital).filter(Hospital.status == "active")
    if hospital_id:
        hosp_query = hosp_query.filter(Hospital.id == hospital_id)
    hospitals = hosp_query.all()

    med_query = db.query(Medicine)
    if medicine_id:
        med_query = med_query.filter(Medicine.id == medicine_id)
    medicines = med_query.all()

    today = date.today()
    warning_cutoff = today + timedelta(days=EXPIRY_WARNING_DAYS)

    # Pre-compute all surplus items across the network to find suggested donors
    all_surplus = get_surplus_hospitals(db)
    surplus_by_med: Dict[int, List[dict]] = {}
    for s in all_surplus:
        surplus_by_med.setdefault(s["medicine_id"], []).append(s)

    for hospital in hospitals:
        for medicine in medicines:
            avg_daily = get_avg_daily_consumption(db, hospital.id, medicine.id)
            if avg_daily == 0:
                continue

            batches = db.query(MedicineBatch).filter(
                MedicineBatch.hospital_id == hospital.id,
                MedicineBatch.medicine_id == medicine.id,
                MedicineBatch.status.notin_(["expired", "quarantined", "recalled"]),
                MedicineBatch.expiry_date > today,
            ).order_by(MedicineBatch.expiry_date.asc()).all()

            available_stock = sum(b.quantity for b in batches)
            committed_stock = sum(min(b.quantity, b.reserved_quantity) for b in batches)

            forecast_demand = round(avg_daily * 30, 1)
            safety_stock = round(avg_daily * SAFETY_STOCK_DAYS, 1)
            required_stock = round(forecast_demand + safety_stock, 1)

            # Available uncommitted stock usable for patients
            net_available = max(0, available_stock - committed_stock)
            shortage = calculate_shortage(required_stock, net_available)
            days_of_cover = calculate_days_of_cover(available_stock, avg_daily)

            if shortage > 0:
                near_expiry_batches = [b for b in batches if b.expiry_date <= warning_cutoff]
                near_expiry_qty = sum(b.quantity for b in near_expiry_batches)
                earliest_expiry = batches[0].expiry_date if batches else None

                # Urgency level
                if days_of_cover < 7 or available_stock == 0:
                    urgency = "critical"
                elif days_of_cover < 14:
                    urgency = "high"
                elif days_of_cover < 30:
                    urgency = "medium"
                else:
                    urgency = "low"

                # Find suggested donor hospitals with surplus for this medicine
                suggested_donors = []
                for donor_surplus in surplus_by_med.get(medicine.id, []):
                    if donor_surplus["hospital_id"] == hospital.id:
                        continue
                    eligible = get_eligible_batches(db, donor_surplus["hospital_id"], medicine.id)
                    earliest_eligible = eligible[0] if eligible else None
                    days_until_exp = (earliest_eligible.expiry_date - today).days if earliest_eligible else None
                    suggested_donors.append({
                        "hospital_id": donor_surplus["hospital_id"],
                        "hospital_name": donor_surplus["hospital_name"],
                        "city": donor_surplus.get("city", ""),
                        "state": donor_surplus.get("state", ""),
                        "available_stock": donor_surplus["available_stock"],
                        "surplus": donor_surplus["surplus"],
                        "batch_id": earliest_eligible.id if earliest_eligible else None,
                        "batch_number": earliest_eligible.batch_number if earliest_eligible else None,
                        "expiry_date": earliest_eligible.expiry_date.isoformat() if earliest_eligible else None,
                        "days_until_expiry": days_until_exp,
                    })

                # Sort donors: FEFO first (earliest expiry first), then highest surplus
                suggested_donors.sort(key=lambda d: (
                    d["days_until_expiry"] if d["days_until_expiry"] is not None else 9999,
                    -d["surplus"]
                ))

                days_cover_display = f"{days_of_cover:.0f}" if days_of_cover != float("inf") else "∞"
                donor_count = len(suggested_donors)
                donor_msg = f"{donor_count} eligible donor hospital{'s' if donor_count != 1 else ''} available" if donor_count > 0 else "No eligible donor hospitals available"
                reason = f"Only {days_cover_display} days cover remaining; short by {shortage} units. ({donor_msg})"

                results.append({
                    "hospital_id": hospital.id,
                    "hospital_name": hospital.name,
                    "city": hospital.city,
                    "state": hospital.state,
                    "medicine_id": medicine.id,
                    "medicine_name": medicine.name,
                    "available_stock": available_stock,
                    "committed_stock": committed_stock,
                    "avg_daily_consumption": round(avg_daily, 2),
                    "days_of_cover": round(days_of_cover, 1) if days_of_cover != float("inf") else float("inf"),
                    "forecast_demand": forecast_demand,
                    "safety_stock": safety_stock,
                    "surplus": 0,
                    "shortage": shortage,
                    "near_expiry_quantity": near_expiry_qty,
                    "expiry_date": earliest_expiry.isoformat() if earliest_expiry else None,
                    "urgency": urgency,
                    "reason": reason,
                    "suggested_donors": suggested_donors,
                })
    return results
