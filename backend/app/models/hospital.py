"""Hospital model."""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class Hospital(Base):
    """Hospital / healthcare institution registered on DoseRelay."""
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    address = Column(String(500), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(String(100), default="India")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    hospital_type = Column(String(50), default="general")  # general, specialty, clinic
    bed_count = Column(Integer, default=0)
    status = Column(String(20), default="active")  # active, inactive
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    users = relationship("User", back_populates="hospital")
    batches = relationship("MedicineBatch", back_populates="hospital")
    consumption_records = relationship("ConsumptionRecord", back_populates="hospital")
