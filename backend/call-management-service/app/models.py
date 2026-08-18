import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class CallSource(str, enum.Enum):
    live = "live"
    uploaded = "uploaded"


class CallStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    live = "live"
    completed = "completed"
    failed = "failed"


class Call(Base):
    __tablename__ = "calls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(Enum(CallSource, name="call_source"), nullable=False)
    status = Column(Enum(CallStatus, name="call_status"), nullable=False, default=CallStatus.pending)

    caller_id = Column(String, nullable=True)
    audio_url = Column(String, nullable=True)
    primary_language = Column(String, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(String, nullable=True)

    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    segments = relationship(
        "TranscriptSegment",
        back_populates="call",
        cascade="all, delete-orphan",
        order_by="TranscriptSegment.sequence",
    )


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), ForeignKey("calls.id", ondelete="CASCADE"), nullable=False)
    sequence = Column(Integer, nullable=False)

    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)
    detected_language = Column(String, nullable=True)
    original_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    is_final = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    call = relationship("Call", back_populates="segments")
