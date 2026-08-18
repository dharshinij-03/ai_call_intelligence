from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import UserRole

# The official 12-department taxonomy — see backend/asset/AI-Powered Citizen
# Call Intelligence Platform.pdf. Kept in sync (by value) with
# call-analysis-service.Department and complaint-assignment-service.
Department = Literal[
    "Water Supply & Sewerage",
    "Sanitation & Solid Waste",
    "Roads & Public Works",
    "Electricity & Street Lighting",
    "Public Transport",
    "Traffic Management",
    "Public Health",
    "Emergency & Disaster Management",
    "Police & Public Safety",
    "Municipal Services",
    "Environment",
    "Revenue & Civic Administration",
]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    phone_number: Optional[str] = None
    role: UserRole = UserRole.citizen
    department: Optional[Department] = None
    # Required when role != "citizen" — see app.config.Settings.admin_bootstrap_key
    admin_bootstrap_key: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    role: Optional[UserRole] = None
    department: Optional[Department] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    phone_number: Optional[str] = None
    full_name: str
    role: UserRole
    department: Optional[str] = None
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
