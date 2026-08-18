import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class AssignmentStatus(str, enum.Enum):
    # Matches the complaint lifecycle in the source PDF (section 26), scoped
    # to the routing/assignment part of it.
    unassigned = "UNASSIGNED"  # classified, but no active officer in that department
    assigned = "ASSIGNED"
    in_progress = "IN_PROGRESS"
    pending_information = "PENDING_INFORMATION"
    resolved = "RESOLVED"
    closed = "CLOSED"
    reopened = "REOPENED"


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)

    department_id = Column(String, nullable=False, index=True)
    department_name = Column(String, nullable=False)
    priority = Column(String, nullable=False)  # critical | high | medium | low

    officer_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    officer_name = Column(String, nullable=True)

    status = Column(Enum(AssignmentStatus, name="assignment_status"), nullable=False, default=AssignmentStatus.unassigned)

    sla_due_at = Column(DateTime(timezone=True), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RecommendationType(str, enum.Enum):
    field_inspection = "FIELD_INSPECTION"
    dispatch_repair_team = "DISPATCH_REPAIR_TEAM"
    desk_resolution = "DESK_RESOLUTION"
    escalate_to_senior_officer = "ESCALATE_TO_SENIOR_OFFICER"
    coordinate_with_other_department = "COORDINATE_WITH_OTHER_DEPARTMENT"
    monitor_situation = "MONITOR_SITUATION"


class Recommendation(Base):
    """AI Recommendation Metadata from the source PDF (section 30) — the
    "Officer Copilot" feature: a suggested fix the officer can accept/reject."""

    __tablename__ = "recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)

    recommendation_text = Column(Text, nullable=False)
    recommendation_type = Column(Enum(RecommendationType, name="recommendation_type"), nullable=False)
    confidence = Column(Float, nullable=False)

    accepted_by_officer = Column(Boolean, nullable=True)  # null = not yet reviewed
    officer_action = Column(Text, nullable=True)

    generated_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
