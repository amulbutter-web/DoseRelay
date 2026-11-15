"""Analytics schemas."""
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ActivityItem(BaseModel):
    id: int
    action: str
    entity_type: Optional[str] = None
    details: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_hospitals: int = 0
    total_medicines: int = 0
    total_batches: int = 0
    hospitals_with_shortages: int = 0
    hospitals_with_surplus: int = 0
    approaching_expiry: int = 0
    pending_transfers: int = 0
    completed_transfers: int = 0
    recent_activities: List[ActivityItem] = []


class ChartDataPoint(BaseModel):
    label: str
    value: float


class AnalyticsResponse(BaseModel):
    total_completed_transfers: int = 0
    total_quantity_redistributed: int = 0
    shortages_addressed: int = 0
    expiry_stock_saved: int = 0
    estimated_value_preserved: float = 0.0
    avg_completion_time_hours: float = 0.0
    transfer_trends: List[ChartDataPoint] = []
    category_distribution: List[ChartDataPoint] = []
    hospital_activity: List[dict] = []


class SuggestedDonor(BaseModel):
    hospital_id: int
    hospital_name: str
    city: Optional[str] = None
    state: Optional[str] = None
    available_stock: int = 0
    surplus: int = 0
    batch_id: Optional[int] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    days_until_expiry: Optional[int] = None


class SurplusShortageItem(BaseModel):
    hospital_id: int
    hospital_name: str
    city: Optional[str] = None
    state: Optional[str] = None
    medicine_id: int
    medicine_name: str
    available_stock: int
    committed_stock: int = 0
    avg_daily_consumption: float
    days_of_cover: float
    forecast_demand: float
    safety_stock: float
    surplus: int = 0
    shortage: int = 0
    near_expiry_quantity: int = 0
    expiry_date: Optional[str] = None
    urgency: str = "low"  # critical, high, medium, low
    reason: str = ""
    suggested_donors: List[SuggestedDonor] = []
