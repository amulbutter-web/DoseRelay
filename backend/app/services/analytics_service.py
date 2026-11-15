"""Analytics service: dashboard stats and reporting."""
from datetime import date, timedelta
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.hospital import Hospital
from app.models.medicine import Medicine, MedicineBatch
from app.models.transfer import Transfer
from app.models.audit import AuditLog
from app.schemas.analytics import DashboardStats, AnalyticsResponse, ActivityItem, ChartDataPoint
from app.services.inventory_service import get_surplus_hospitals, get_shortage_hospitals, EXPIRY_WARNING_DAYS


def get_dashboard_stats(db: Session) -> DashboardStats:
    """Compute live dashboard statistics from the database."""
    total_hospitals = db.query(Hospital).filter(Hospital.status == "active").count()
    total_medicines = db.query(Medicine).count()
    total_batches = db.query(MedicineBatch).filter(
        MedicineBatch.status.notin_(["expired"])
    ).count()

    surplus_data = get_surplus_hospitals(db)
    shortage_data = get_shortage_hospitals(db)

    surplus_hospital_ids = {r["hospital_id"] for r in surplus_data}
    shortage_hospital_ids = {r["hospital_id"] for r in shortage_data}

    today = date.today()
    cutoff = today + timedelta(days=EXPIRY_WARNING_DAYS)
    approaching_expiry = db.query(MedicineBatch).filter(
        MedicineBatch.expiry_date <= cutoff,
        MedicineBatch.expiry_date >= today,
        MedicineBatch.status.notin_(["quarantined", "recalled"]),
    ).count()

    pending_statuses = [
        "pending_mto_review", "awaiting_donor_approval",
        "awaiting_receiver_approval", "approved",
        "ready_for_dispatch", "dispatched", "in_transit",
        "delivered", "receipt_verified",
    ]
    pending_transfers = db.query(Transfer).filter(Transfer.status.in_(pending_statuses)).count()
    completed_transfers = db.query(Transfer).filter(Transfer.status == "completed").count()

    recent_logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(10).all()
    recent_activities = [
        ActivityItem(
            id=log.id,
            action=log.action,
            entity_type=log.entity_type,
            details=log.details,
            created_at=log.created_at,
        )
        for log in recent_logs
    ]

    return DashboardStats(
        total_hospitals=total_hospitals,
        total_medicines=total_medicines,
        total_batches=total_batches,
        hospitals_with_shortages=len(shortage_hospital_ids),
        hospitals_with_surplus=len(surplus_hospital_ids),
        approaching_expiry=approaching_expiry,
        pending_transfers=pending_transfers,
        completed_transfers=completed_transfers,
        recent_activities=recent_activities,
    )


def get_analytics(db: Session) -> AnalyticsResponse:
    """Compute analytics metrics for the reporting dashboard."""
    completed = db.query(Transfer).filter(Transfer.status == "completed").all()
    total_completed = len(completed)
    total_qty = sum(t.received_quantity or t.quantity for t in completed)

    # Transfer trends – last 30 days
    today = date.today()
    trends: List[ChartDataPoint] = []
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        count = db.query(Transfer).filter(
            func.date(Transfer.created_at) == d
        ).count()
        trends.append(ChartDataPoint(label=d.strftime("%d %b"), value=float(count)))

    # Category distribution
    cat_rows = db.query(Medicine.category, func.count(Transfer.id)).join(
        Transfer, Transfer.medicine_id == Medicine.id
    ).group_by(Medicine.category).all()
    category_dist = [ChartDataPoint(label=r[0] or "Other", value=float(r[1])) for r in cat_rows]

    # Hospital activity
    hospitals = db.query(Hospital).all()
    hospital_activity = []
    for h in hospitals:
        sent = db.query(Transfer).filter(
            Transfer.donor_hospital_id == h.id,
            Transfer.status == "completed"
        ).count()
        received = db.query(Transfer).filter(
            Transfer.receiver_hospital_id == h.id,
            Transfer.status == "completed"
        ).count()
        if sent > 0 or received > 0:
            hospital_activity.append({"hospital": h.name, "sent": sent, "received": received})

    # Estimated value preserved
    value_preserved = sum(
        (t.received_quantity or t.quantity) * (
            db.query(MedicineBatch).filter(MedicineBatch.id == t.batch_id).first().unit_price or 0
        )
        for t in completed
    )

    return AnalyticsResponse(
        total_completed_transfers=total_completed,
        total_quantity_redistributed=total_qty,
        shortages_addressed=total_completed,
        expiry_stock_saved=sum(1 for t in completed if db.query(MedicineBatch).filter(
            MedicineBatch.id == t.batch_id,
            MedicineBatch.status.in_(["approaching_expiry", "critical"])
        ).count() > 0),
        estimated_value_preserved=round(value_preserved, 2),
        avg_completion_time_hours=0.0,
        transfer_trends=trends,
        category_distribution=category_dist,
        hospital_activity=hospital_activity,
    )
