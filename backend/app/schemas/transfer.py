"""Transfer and recommendation schemas."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TransferCreate(BaseModel):
    recommendation_id: Optional[int] = None
    donor_hospital_id: int
    receiver_hospital_id: int
    medicine_id: int
    batch_id: int
    quantity: int


class TransferStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    cancellation_reason: Optional[str] = None


class MTOReview(BaseModel):
    approved: bool
    notes: Optional[str] = None


class PharmacistApproval(BaseModel):
    approved: bool
    notes: Optional[str] = None


class LogisticsUpdate(BaseModel):
    dispatch_date: Optional[datetime] = None
    estimated_delivery: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None
    delivery_notes: Optional[str] = None


class ReceiptVerification(BaseModel):
    received_quantity: int
    notes: Optional[str] = None


class TransferResponse(BaseModel):
    id: int
    recommendation_id: Optional[int] = None
    donor_hospital_id: int
    receiver_hospital_id: int
    medicine_id: int
    batch_id: int
    quantity: int
    status: str
    qr_code_token: Optional[str] = None
    mto_id: Optional[int] = None
    mto_notes: Optional[str] = None
    donor_pharmacist_id: Optional[int] = None
    donor_approval_at: Optional[datetime] = None
    donor_notes: Optional[str] = None
    receiver_pharmacist_id: Optional[int] = None
    receiver_approval_at: Optional[datetime] = None
    receiver_notes: Optional[str] = None
    logistics_personnel_id: Optional[int] = None
    dispatch_date: Optional[datetime] = None
    estimated_delivery: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None
    delivery_notes: Optional[str] = None
    received_quantity: Optional[int] = None
    receipt_verified: bool = False
    rejection_reason: Optional[str] = None
    cancellation_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    donor_hospital_name: Optional[str] = None
    receiver_hospital_name: Optional[str] = None
    medicine_name: Optional[str] = None
    batch_number: Optional[str] = None

    class Config:
        from_attributes = True


class RecommendationResponse(BaseModel):
    id: int
    donor_hospital_id: int
    receiver_hospital_id: int
    medicine_id: int
    batch_id: int
    recommended_quantity: int
    reason: str
    eligibility_notes: Optional[str] = None
    warnings: Optional[str] = None
    priority: str
    status: str
    created_at: Optional[datetime] = None
    donor_hospital_name: Optional[str] = None
    receiver_hospital_name: Optional[str] = None
    medicine_name: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None

    class Config:
        from_attributes = True
