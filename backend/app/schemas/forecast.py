"""Forecast schemas."""
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class ForecastRequest(BaseModel):
    hospital_id: int
    medicine_id: int
    days_ahead: int = 30


class ForecastResponse(BaseModel):
    id: int
    hospital_id: int
    medicine_id: int
    forecast_date: date
    forecasted_quantity: float
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    model_used: Optional[str] = None
    mae: Optional[float] = None
    rmse: Optional[float] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ForecastSummary(BaseModel):
    hospital_id: int
    hospital_name: str
    medicine_id: int
    medicine_name: str
    avg_daily_consumption: float
    forecasted_30d_demand: float
    current_stock: int
    days_of_cover: float
    stockout_risk: str
    model_used: str
    mae: Optional[float] = None
    rmse: Optional[float] = None
