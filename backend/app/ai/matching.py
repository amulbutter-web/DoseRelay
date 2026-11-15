"""Medicine matching engine: generate TransferRecommendation records."""
from datetime import date, timedelta
from typing import List
from sqlalchemy.orm import Session

from app.models.hospital import Hospital
from app.models.medicine import Medicine, MedicineBatch
from app.models.transfer import TransferRecommendation
from app.services.inventory_service import (
    get_surplus_hospitals, get_shortage_hospitals,
    get_eligible_batches, get_available_quantity,
    get_avg_daily_consumption,
)

MIN_EXPIRY_DAYS = 30
MIN_TRANSFER_QTY = 10


def _days_remaining(expiry_date: date) -> int:
    return (expiry_date - date.today()).days


def _priority(shortage: int, days_cover: float) -> str:
    if days_cover < 7 or shortage > 500:
        return "high"
    elif days_cover < 14 or shortage > 100:
        return "medium"
    return "low"


def generate_recommendations(db: Session) -> List[TransferRecommendation]:
    """
    Match surplus hospitals to shortage hospitals for the same medicine.
    Returns newly created TransferRecommendation objects.
    """
    # Clear old pending recommendations
    db.query(TransferRecommendation).filter(
        TransferRecommendation.status == "pending"
    ).delete()
    db.flush()

    surplus_list = get_surplus_hospitals(db)
    shortage_list = get_shortage_hospitals(db)

    if not surplus_list or not shortage_list:
        db.commit()
        return []

    # Index surplus by medicine_id -> list of surplus entries
    surplus_by_medicine: dict = {}
    for s in surplus_list:
        surplus_by_medicine.setdefault(s["medicine_id"], []).append(s)

    recommendations = []

    for shortage in shortage_list:
        med_id = shortage["medicine_id"]
        if med_id not in surplus_by_medicine:
            continue

        for surplus in surplus_by_medicine[med_id]:
            # Don't transfer to yourself
            if surplus["hospital_id"] == shortage["hospital_id"]:
                continue

            eligible_batches = get_eligible_batches(db, surplus["hospital_id"], med_id)
            if not eligible_batches:
                continue

            # Pick earliest-expiring eligible batch (FEFO)
            batch = eligible_batches[0]
            days_rem = _days_remaining(batch.expiry_date)
            if days_rem < MIN_EXPIRY_DAYS:
                continue

            available = get_available_quantity(batch)
            # Transfer the minimum of what's surplus and what's needed
            qty = min(available, shortage["shortage"])
            if qty < MIN_TRANSFER_QTY:
                continue

            # Build eligibility notes
            eligibility = (
                f"Batch {batch.batch_number}: {days_rem} days remaining until expiry. "
                f"Available: {available} units. Status: {batch.status}."
            )

            warnings = None
            if days_rem < 60:
                warnings = f"Batch expires in {days_rem} days – verify suitability."

            priority = _priority(shortage["shortage"], shortage["days_of_cover"])

            reason = (
                f"{shortage['hospital_name']} has only {shortage['days_of_cover']:.0f} days "
                f"of {shortage['medicine_name']} remaining (shortage: {shortage['shortage']} units). "
                f"{surplus['hospital_name']} has surplus of {surplus['surplus']} units."
            )

            rec = TransferRecommendation(
                donor_hospital_id=surplus["hospital_id"],
                receiver_hospital_id=shortage["hospital_id"],
                medicine_id=med_id,
                batch_id=batch.id,
                recommended_quantity=qty,
                reason=reason,
                eligibility_notes=eligibility,
                warnings=warnings,
                priority=priority,
                status="pending",
            )
            db.add(rec)
            recommendations.append(rec)

            # Reduce remaining surplus to avoid over-recommending
            surplus["surplus"] = max(0, surplus["surplus"] - qty)
            if surplus["surplus"] == 0:
                break

    db.commit()
    for r in recommendations:
        db.refresh(r)
    return recommendations
