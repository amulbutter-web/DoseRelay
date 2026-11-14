"""Transfer-related models: recommendations, transfers."""
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class TransferRecommendation(Base):
    """AI-generated transfer recommendation."""
    __tablename__ = "transfer_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    donor_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    receiver_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("medicine_batches.id"), nullable=False)
    recommended_quantity = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    eligibility_notes = Column(Text, nullable=True)
    warnings = Column(Text, nullable=True)
    priority = Column(String(20), default="medium")  # high, medium, low
    status = Column(String(20), default="pending")  # pending, accepted, rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Transfer(Base):
    """Medicine transfer record tracking the full workflow."""
    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(Integer, ForeignKey("transfer_recommendations.id"), nullable=True)
    donor_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    receiver_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("medicine_batches.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(String(30), default="recommended")
    qr_code_token = Column(String(255), unique=True, nullable=True)
    
    # MTO
    mto_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    mto_notes = Column(Text, nullable=True)
    
    # Donor pharmacist approval
    donor_pharmacist_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    donor_approval_at = Column(DateTime(timezone=True), nullable=True)
    donor_notes = Column(Text, nullable=True)
    
    # Receiver pharmacist approval
    receiver_pharmacist_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    receiver_approval_at = Column(DateTime(timezone=True), nullable=True)
    receiver_notes = Column(Text, nullable=True)
    
    # Logistics
    logistics_personnel_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    dispatch_date = Column(DateTime(timezone=True), nullable=True)
    estimated_delivery = Column(DateTime(timezone=True), nullable=True)
    actual_delivery = Column(DateTime(timezone=True), nullable=True)
    delivery_notes = Column(Text, nullable=True)
    
    # Receipt
    received_quantity = Column(Integer, nullable=True)
    receipt_verified = Column(Boolean, default=False)
    
    # Rejection / cancellation
    rejection_reason = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
