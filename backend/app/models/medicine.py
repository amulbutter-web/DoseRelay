"""Medicine and MedicineBatch models."""
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class Medicine(Base):
    """Medicine / drug registered in the system."""
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    generic_name = Column(String(255), nullable=True)
    active_ingredient = Column(String(255), nullable=True)
    strength = Column(String(100), nullable=True)
    dosage_form = Column(String(50), default="tablet")  # tablet, capsule, injection, syrup, cream, other
    category = Column(String(100), nullable=True)
    manufacturer = Column(String(255), nullable=True)
    requires_cold_storage = Column(Boolean, default=False)
    controlled_substance = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    batches = relationship("MedicineBatch", back_populates="medicine")
    consumption_records = relationship("ConsumptionRecord", back_populates="medicine")


class MedicineBatch(Base):
    """Individual batch of a medicine at a specific hospital."""
    __tablename__ = "medicine_batches"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    batch_number = Column(String(100), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    reserved_quantity = Column(Integer, nullable=False, default=0)
    manufacturing_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=False)
    unit_price = Column(Float, nullable=True, default=0.0)
    storage_temp_min = Column(Float, nullable=True)
    storage_temp_max = Column(Float, nullable=True)
    status = Column(String(30), default="normal")  # normal, approaching_expiry, critical, expired, quarantined, recalled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("batch_number", "hospital_id", "medicine_id", name="uq_batch_hospital_medicine"),
    )

    medicine = relationship("Medicine", back_populates="batches")
    hospital = relationship("Hospital", back_populates="batches")
