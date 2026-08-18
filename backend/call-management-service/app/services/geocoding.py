"""Reverse-geocodes GPS coordinates into a human-readable address via
OpenStreetMap's Nominatim — free, no API key or signup required.

Nominatim's usage policy requires a descriptive User-Agent and caps
usage at ~1 request/second, which is fine for per-call lookups here:
https://operations.osmfoundation.org/policies/nominatim/
"""

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"


async def reverse_geocode(latitude: float, longitude: float) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                NOMINATIM_URL,
                params={"lat": latitude, "lon": longitude, "format": "jsonv2"},
                headers={"User-Agent": "call-management-service/1.0 (hackathon complaint portal)"},
            )
        response.raise_for_status()
        return response.json().get("display_name")
    except Exception:
        logger.exception("Reverse geocoding failed for (%s, %s)", latitude, longitude)
        return None
