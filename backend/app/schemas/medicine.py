"""Medicine and batch schemas."""
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class MedicineCreate(BaseModel):
    name: str
    generic_name: Optional[str] = None
    active_ingredient: Optional[str] = None
    strength: Optional[str] = None
    dosage_form: str = "tablet"
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    requires_cold_storage: bool = False
    controlled_substance: bool = False


class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    generic_name: Optional[str] = None
    active_ingredient: Optional[str] = None
    strength: Optional[str] = None
    dosage_form: Optional[str] = None
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    requires_cold_storage: Optional[bool] = None
    controlled_substance: Optional[bool] = None


class MedicineResponse(BaseModel):
    id: int
    name: str
    generic_name: Optional[str] = None
    active_ingredient: Optional[str] = None
    strength: Optional[str] = None
    dosage_form: str
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    requires_cold_storage: bool
    controlled_substance: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BatchCreate(BaseModel):
    medicine_id: int
    hospital_id: int
    batch_number: str
    quantity: int
    manufacturing_date: Optional[date] = None
    expiry_date: date
    unit_price: float = 0.0
    storage_temp_min: Optional[float] = None
    storage_temp_max: Optional[float] = None


class BatchUpdate(BaseModel):
    quantity: Optional[int] = None
    status: Optional[str] = None
    storage_temp_min: Optional[float] = None
    storage_temp_max: Optional[float] = None


class BatchResponse(BaseModel):
    id: int
    medicine_id: int
    hospital_id: int
    batch_number: str
    quantity: int
    reserved_quantity: int
    manufacturing_date: Optional[date] = None
    expiry_date: date
    unit_price: Optional[float] = None
    storage_temp_min: Optional[float] = None
    storage_temp_max: Optional[float] = None
    status: str
    created_at: Optional[datetime] = None
    medicine_name: Optional[str] = None
    hospital_name: Optional[str] = None

    class Config:
        from_attributes = True
