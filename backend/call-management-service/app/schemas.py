from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sequence: int
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    detected_language: Optional[str] = None
    original_text: str
    translated_text: Optional[str] = None
    confidence: Optional[float] = None
    is_final: bool


class CallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source: str
    status: str
    caller_id: Optional[str] = None
    primary_language: Optional[str] = None
    duration_seconds: Optional[float] = None
    error_message: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    created_at: datetime


class CallDetailOut(CallOut):
    segments: List[SegmentOut] = []
