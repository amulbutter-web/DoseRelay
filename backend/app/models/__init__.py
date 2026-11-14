"""Import all models so SQLAlchemy can discover them."""
from app.models.user import User
from app.models.hospital import Hospital
from app.models.medicine import Medicine, MedicineBatch
from app.models.consumption import ConsumptionRecord
from app.models.forecast import DemandForecast
from app.models.transfer import TransferRecommendation, Transfer
from app.models.audit import AuditLog, Notification

__all__ = [
    "User",
    "Hospital",
    "Medicine",
    "MedicineBatch",
    "ConsumptionRecord",
    "DemandForecast",
    "TransferRecommendation",
    "Transfer",
    "AuditLog",
    "Notification",
]
