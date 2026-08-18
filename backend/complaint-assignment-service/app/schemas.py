from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models import AssignmentStatus, RecommendationType


class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    call_id: UUID
    department_id: str
    department_name: str
    priority: str
    officer_id: Optional[UUID] = None
    officer_name: Optional[str] = None
    status: AssignmentStatus
    sla_due_at: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    created_at: datetime


class AssignmentStatusUpdate(BaseModel):
    status: AssignmentStatus


class DepartmentOut(BaseModel):
    id: str
    code: str
    name: str


class FixRecommendation(BaseModel):
    """Schema handed to Gemini as response_schema for the officer-facing
    'how do I fix this' suggestion."""

    recommendation_text: str = Field(
        description="A concise, actionable field recommendation for the officer — one or two sentences, "
        "specific to this complaint (not generic advice)."
    )
    recommendation_type: RecommendationType = Field(description="The category of action being recommended.")
    confidence: float = Field(ge=0, le=1, description="Confidence in this recommendation, from 0 to 1.")


class RecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    call_id: UUID
    recommendation_text: str
    recommendation_type: RecommendationType
    confidence: float
    accepted_by_officer: Optional[bool] = None
    officer_action: Optional[str] = None
    generated_at: datetime
    created_at: datetime


class RecommendationReview(BaseModel):
    accepted_by_officer: bool
    officer_action: Optional[str] = None
