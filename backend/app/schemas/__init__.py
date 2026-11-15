"""Pydantic schemas for DoseRelay."""
from app.schemas.user import UserCreate, UserUpdate, UserResponse, Token, LoginRequest, PasswordChange
from app.schemas.hospital import HospitalCreate, HospitalUpdate, HospitalResponse, HospitalWithStats
from app.schemas.medicine import MedicineCreate, MedicineUpdate, MedicineResponse, BatchCreate, BatchUpdate, BatchResponse
from app.schemas.transfer import TransferCreate, TransferResponse, RecommendationResponse, MTOReview, PharmacistApproval, LogisticsUpdate, ReceiptVerification, TransferStatusUpdate
from app.schemas.forecast import ForecastRequest, ForecastResponse, ForecastSummary
from app.schemas.analytics import DashboardStats, AnalyticsResponse, SurplusShortageItem, ActivityItem, SuggestedDonor
