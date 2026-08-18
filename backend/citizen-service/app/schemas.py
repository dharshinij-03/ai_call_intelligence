from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models import CallSessionStatus


class CallRequestIn(BaseModel):
    """Request body for creating a new call"""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None


class CallSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    citizen_id: UUID
    citizen_name: str
    operator_id: Optional[UUID] = None
    operator_name: Optional[str] = None
    status: CallSessionStatus
    requested_at: datetime
    connected_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None


class ComplaintStatusOut(BaseModel):
    call_id: UUID
    call_session_id: UUID
    requested_at: datetime
    department_name: Optional[str] = None
    summary: Optional[str] = None
    urgency: Optional[str] = None
    sentiment: Optional[str] = None
    location: Optional[str] = None
    assignment_status: Optional[str] = None
    officer_name: Optional[str] = None
    sla_due_at: Optional[datetime] = None


class ComplaintStatusListOut(BaseModel):
    items: List[ComplaintStatusOut]
