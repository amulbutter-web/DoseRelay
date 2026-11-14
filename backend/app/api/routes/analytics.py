"""Analytics and reporting routes."""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io, csv

from app.db.base import get_db
from app.core.security import get_current_user
from app.services.analytics_service import get_dashboard_stats, get_analytics
from app.schemas.analytics import DashboardStats, AnalyticsResponse

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return get_dashboard_stats(db)


@router.get("/reports", response_model=AnalyticsResponse)
def reports(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return get_analytics(db)


@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db), _=Depends(get_current_user)):
    from app.models.transfer import Transfer
    from app.models.hospital import Hospital
    from app.models.medicine import Medicine

    transfers = db.query(Transfer).filter(Transfer.status == "completed").all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Transfer ID", "Donor Hospital", "Receiver Hospital",
        "Medicine", "Quantity", "Status", "Created At",
    ])
    for t in transfers:
        dh = db.query(Hospital).filter(Hospital.id == t.donor_hospital_id).first()
        rh = db.query(Hospital).filter(Hospital.id == t.receiver_hospital_id).first()
        med = db.query(Medicine).filter(Medicine.id == t.medicine_id).first()
        writer.writerow([
            t.id,
            dh.name if dh else t.donor_hospital_id,
            rh.name if rh else t.receiver_hospital_id,
            med.name if med else t.medicine_id,
            t.quantity,
            t.status,
            t.created_at,
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.read().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=doserelay_transfers.csv"},
    )
