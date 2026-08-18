"""Fetches a call's transcript + captured GPS location from call-management-service.

Accepts either a real call-management UUID or a citizen-service session ID
(which is stored as caller_id in call-management-service).  The lookup
order is:
  1. Try GET /calls/{call_id} (works when call_id is the CM UUID).
  2. On 404, try GET /calls/by-caller/{call_id} (resolves citizen session ID → CM UUID).
"""

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

import httpx

from app.config import get_settings


class CallNotFound(Exception):
    pass


@dataclass
class CallContext:
    transcript: str
    captured_address: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]


_BLOCKLIST = {
    "thanks for watching.", "thank you for watching.", "subscribe",
    "thanks for watching", "you", ".", "...", "[music]", "[applause]"
}

def _parse_call(call: dict) -> "CallContext":
    segments = call.get("segments", [])
    
    # If high-confidence client_transcript segments exist (0.95+), use ONLY high-confidence segments
    high_conf_segments = [s for s in segments if (s.get("confidence") or 0) >= 0.95]
    target_segments = high_conf_segments if high_conf_segments else segments

    cleaned_lines = []

    for seg in target_segments:
        text = (seg.get("translated_text") or seg.get("original_text") or "").strip()
        if not text:
            continue
        if text.lower().strip(".! ") in _BLOCKLIST:
            continue

        # Substring deduplication: avoid adding overlapping or duplicate phrases
        is_sub = False
        for idx, existing in enumerate(cleaned_lines):
            if text.lower() in existing.lower():
                is_sub = True
                break
            elif existing.lower() in text.lower():
                cleaned_lines[idx] = text  # Replace shorter with longer complete sentence
                is_sub = True
                break
        if not is_sub:
            cleaned_lines.append(text)

    transcript_text = "\n".join(cleaned_lines) if cleaned_lines else "Citizen called regarding a civic grievance."
    return CallContext(
        transcript=transcript_text,
        captured_address=call.get("address"),
        latitude=call.get("latitude"),
        longitude=call.get("longitude"),
    )


async def fetch_call_context(call_id: UUID) -> "CallContext":
    settings = get_settings()
    base = settings.call_management_service_url

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Try direct UUID lookup
        response = await client.get(f"{base}/calls/{call_id}")

        if response.status_code == 404:
            # 2. Resolve citizen session ID → real call UUID via caller_id lookup
            response2 = await client.get(f"{base}/calls/by-caller/{call_id}")
            if response2.status_code == 404:
                raise CallNotFound(f"Call {call_id} not found in call-management-service")
            response2.raise_for_status()
            return _parse_call(response2.json())

        response.raise_for_status()
        return _parse_call(response.json())
