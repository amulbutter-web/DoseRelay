"""Additive registration and request records; existing inventory schema is unchanged."""

from sqlalchemy import Column, Integer, String, ForeignKey, JSON, LargeBinary
from app.db.base import Base


class FacilityRegistration(Base):
    __tablename__ = "facility_registrations"
    id = Column(Integer, primary_key=True)
    hospital_id = Column(
        Integer, ForeignKey("hospitals.id"), unique=True, nullable=False
    )
    nin = Column(String(10), unique=True, nullable=False)
    data = Column(JSON, nullable=False)
    nin_status = Column(String(50), default="VERIFICATION PENDING", nullable=False)
    registration_status = Column(
        String(50), default="VERIFICATION PENDING", nullable=False
    )
    licence_status = Column(String(30), default="PENDING", nullable=False)


class VerificationDocument(Base):
    __tablename__ = "verification_documents"
    id = Column(String(36), primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    kind = Column(String(30), nullable=False)
    name = Column(String(255), nullable=False)
    mime = Column(String(80), nullable=False)
    content = Column(LargeBinary, nullable=False)


class MedicineRequest(Base):
    __tablename__ = "medicine_requests"
    id = Column(String(36), primary_key=True)
    receiver_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    transfer_id = Column(Integer, ForeignKey("transfers.id"), unique=True)
    status = Column(String(50), default="open_awaiting_donor", nullable=False)
    data = Column(JSON, nullable=False)


class RevokedSession(Base):
    __tablename__ = "revoked_sessions"
    id = Column(String(64), primary_key=True)


# A partial unique index enforces the single central account even for concurrent provisioning.
from sqlalchemy import Index, text
from app.models.user import User

central_mto_index = Index(
    "uq_users_central_mto",
    User.role,
    unique=True,
    sqlite_where=text("role = 'mto'"),
    postgresql_where=text("role = 'mto'"),
)
