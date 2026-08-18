"""Cross-checks a new complaint against the database for duplicates.

Two-stage: a cheap SQL pre-filter (same department, recent time window,
nearby GPS coordinates) narrows the field to a handful of candidates, then
Gemini confirms whether any of them actually describes the same real-world
incident — a naive text/location match alone would false-positive on e.g.
two unrelated potholes reported the same day on the same street.
"""

from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CallAnalysis
from app.services import gemini_service

DUPLICATE_RADIUS_KM = 1.0
DUPLICATE_WINDOW_HOURS = 48


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


async def find_duplicate(
    db: AsyncSession,
    *,
    exclude_call_id: UUID,
    department: str,
    summary: str,
    latitude: Optional[float],
    longitude: Optional[float],
) -> Optional[CallAnalysis]:
    """Returns the existing CallAnalysis this complaint duplicates, or None.

    Requires GPS coordinates on the new complaint — department + time alone
    is too weak a signal (many unrelated incidents share a department and a
    day) to flag as a duplicate without knowing they're also nearby.
    """
    if latitude is None or longitude is None:
        return None

    since = datetime.now(timezone.utc) - timedelta(hours=DUPLICATE_WINDOW_HOURS)

    stmt = select(CallAnalysis).where(
        CallAnalysis.department == department,
        CallAnalysis.call_id != exclude_call_id,
        CallAnalysis.created_at >= since,
        CallAnalysis.latitude.is_not(None),
        CallAnalysis.longitude.is_not(None),
    )
    candidates = (await db.scalars(stmt)).all()

    nearby = [
        c
        for c in candidates
        if _haversine_km(latitude, longitude, c.latitude, c.longitude) <= DUPLICATE_RADIUS_KM
    ]

    for candidate in nearby:
        if gemini_service.is_same_incident(summary, candidate.summary):
            return candidate

    return None
