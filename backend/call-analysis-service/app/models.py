import uuid

from sqlalchemy import ARRAY, Boolean, Column, DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class CallAnalysis(Base):
    __tablename__ = "call_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)

    summary = Column(Text, nullable=False)
    sentiment = Column(String, nullable=False)
    urgency = Column(String, nullable=False)
    department = Column(String, nullable=False, index=True)
    location = Column(String, nullable=True)
    tags = Column(ARRAY(String), nullable=False, default=list)
    reasoning = Column(Text, nullable=True)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    is_duplicate = Column(Boolean, nullable=False, default=False)
    duplicate_of_call_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    transcript_snapshot = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
