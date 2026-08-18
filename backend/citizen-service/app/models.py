import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, String, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class CallSessionStatus(str, enum.Enum):
    waiting = "WAITING"
    connected = "CONNECTED"
    ended = "ENDED"
    cancelled = "CANCELLED"


class CallSession(Base):
    """A citizen's call request and its match to an operator. The actual
    voice audio is a direct WebRTC peer connection between the two
    browsers — this row tracks queue state and matching only, plus the
    signaling relay in routers/calls.py uses call_session.id for routing.

    call-management-service's live transcription is a separate call the
    citizen's browser makes directly, using this row's id (as a string) as
    that service's `caller_id` — that's how GET /complaints/mine correlates
    a call session back to its resulting complaint, without this service
    needing to know call-management-service's internal call id at all.
    """

    __tablename__ = "call_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    citizen_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    citizen_name = Column(String, nullable=False)

    operator_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    operator_name = Column(String, nullable=True)

    status = Column(Enum(CallSessionStatus, name="call_session_status"), nullable=False, default=CallSessionStatus.waiting)

    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    connected_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Geolocation data captured from citizen's device
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)
    location_accuracy = Column(Float, nullable=True)  # Accuracy in meters
