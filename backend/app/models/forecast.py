"""Demand forecast model."""
from sqlalchemy import Column, Integer, Float, String, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class DemandForecast(Base):
    """AI-generated demand forecast for a medicine at a hospital."""
    __tablename__ = "demand_forecasts"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False, index=True)
    forecast_date = Column(Date, nullable=False)
    forecasted_quantity = Column(Float, nullable=False)
    lower_bound = Column(Float, nullable=True)
    upper_bound = Column(Float, nullable=True)
    model_used = Column(String(100), nullable=True)
    mae = Column(Float, nullable=True)
    rmse = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
