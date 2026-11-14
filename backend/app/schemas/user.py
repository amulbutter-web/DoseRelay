"""User schemas."""
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    email: str
    username: str
    password: str
    full_name: str
    role: str
    hospital_id: Optional[int] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        allowed = ["network_admin", "hospital_admin", "pharmacist", "mto", "logistics"]
        if v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(allowed)}")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    hospital_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    role: str
    hospital_id: Optional[int] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None


class TokenData(BaseModel):
    user_id: Optional[int] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
