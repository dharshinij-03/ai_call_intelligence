from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class DepartmentSummaryOut(BaseModel):
    id: str
    code: str
    name: str
    officer_count: int
    total_complaints: int
    open_complaints: int
    resolved_complaints: int
    critical_complaints: int
    sla_breaches: int


class OfficerSummaryOut(BaseModel):
    id: UUID
    full_name: str
    email: str
    department: Optional[str] = None
    is_active: bool
    open_workload: int
    resolved_count: int
    avg_resolution_hours: Optional[float] = None
    sla_compliance_pct: Optional[float] = None


class ComplaintOut(BaseModel):
    call_id: UUID
    source: Optional[str] = None
    call_status: Optional[str] = None
    created_at: datetime
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    sentiment: Optional[str] = None
    urgency: Optional[str] = None
    summary: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    tags: Optional[List[str]] = None
    is_duplicate: Optional[bool] = None
    duplicate_of_call_id: Optional[UUID] = None
    assignment_status: Optional[str] = None
    officer_id: Optional[UUID] = None
    officer_name: Optional[str] = None
    sla_due_at: Optional[datetime] = None


class ComplaintDetailOut(ComplaintOut):
    reasoning: Optional[str] = None
    recommendation_text: Optional[str] = None
    recommendation_type: Optional[str] = None
    recommendation_confidence: Optional[float] = None
    officer_action: Optional[str] = None


class ComplaintListOut(BaseModel):
    total: int
    items: List[ComplaintOut]


class HeatmapCellOut(BaseModel):
    latitude: float
    longitude: float
    complaint_count: int
    critical_count: int
    dominant_department: Optional[str] = None


class TrendPointOut(BaseModel):
    day: date
    department_name: Optional[str] = None
    count: int


class OverviewOut(BaseModel):
    total_complaints: int
    open_complaints: int
    resolved_complaints: int
    critical_complaints: int
    duplicate_complaints: int
    sla_breaches: int
    departments: List[DepartmentSummaryOut]
