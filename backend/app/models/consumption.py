"""Consumption record model."""
from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class ConsumptionRecord(Base):
    """Daily medicine consumption record at a hospital."""
    __tablename__ = "consumption_records"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    quantity_consumed = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    hospital = relationship("Hospital", back_populates="consumption_records")
    medicine = relationship("Medicine", back_populates="consumption_records")
