"""Hospital schemas."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class HospitalCreate(BaseModel):
    name: str
    code: str
    address: str
    city: str
    state: str
    country: str = "India"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    hospital_type: str = "general"
    bed_count: int = 0


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    hospital_type: Optional[str] = None
    bed_count: Optional[int] = None
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class HospitalResponse(BaseModel):
    id: int
    name: str
    code: str
    address: str
    city: str
    state: str
    country: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    hospital_type: str
    bed_count: int
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HospitalWithStats(HospitalResponse):
    total_batches: int = 0
    total_medicines: int = 0
    surplus_count: int = 0
    shortage_count: int = 0
    expiry_alert_count: int = 0
