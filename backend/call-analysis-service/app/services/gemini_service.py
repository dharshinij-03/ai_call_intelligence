"""Wraps the Gemini API for structured sentiment/summary/department extraction."""

import concurrent.futures
from functools import lru_cache
import logging
import time
from typing import Optional

from google import genai
from google.genai import types

from app.config import get_settings
from app.schemas import ComplaintAnalysis, DuplicateCheck

logger = logging.getLogger(__name__)

DUPLICATE_PROMPT_TEMPLATE = """Two citizen complaints were filed with a municipal grievance portal, \
close together in time and location. Decide whether they describe the SAME real-world incident \
(e.g. the same house fire, the same pothole, the same water outage) rather than two separate \
problems that just happen to be nearby and in the same category.

Complaint A: {summary_a}

Complaint B: {summary_b}
"""

PROMPT_TEMPLATE = """You are triaging a citizen complaint call for a municipal grievance portal. \
The transcript below is already translated into English. It may contain raw live speech fragments or repetitions.

Filter out any filler, stutters, or repetitive speech fragments, extract the true civic issue being reported, and extract:
- summary: exactly two clean, grammatically correct, professional sentences in English summarizing the citizen's grievance clearly.
- sentiment: the caller's overall emotional tone.
- urgency: how urgently this needs a response (critical = immediate danger to life/property).
- department: the single best-fit civic department to route this to.
- location: the address a field team should be sent to. {location_instruction}
- tags: a few short lowercase keywords.
- reasoning: one sentence on why you picked that department.

Transcript:
---
{transcript}
---
"""

WITH_GPS_INSTRUCTION = (
    "The caller's device reported this GPS-derived address: \"{captured_address}\". "
    "Use it as the base location. If the transcript adds a more precise detail "
    "(e.g. a floor, landmark, or building name), append it to the GPS address instead of replacing it."
)
WITHOUT_GPS_INSTRUCTION = (
    "No GPS location was captured for this call. Only use a location if a specific address, "
    "area, or landmark was actually mentioned in the transcript — otherwise return null. Never guess."
)


@lru_cache
def _client() -> genai.Client:
    settings = get_settings()
    return genai.Client(api_key=settings.gemini_api_key)


def _clean_transcript_to_summary(transcript: str, dept: str) -> str:
    """Build a clean 2-sentence summary without repeating raw speech fragments."""
    if not transcript or transcript == "Citizen called regarding a civic grievance.":
        return f"Citizen reported a grievance regarding {dept.lower()}. Field team inspection has been requested."

    lines = [s.strip() for s in transcript.replace("\n", ". ").split(".") if s.strip()]
    cleaned = []
    seen = set()
    for line in lines:
        low = line.lower()
        if low in seen or len(line) < 4:
            continue
        # Substring deduplication
        if any(low in existing.lower() for existing in cleaned):
            continue
        seen.add(low)
        cleaned.append(line[0].upper() + line[1:])

    if not cleaned:
        return f"Citizen reported an issue regarding {dept.lower()}. Prompt field team resolution requested."

    first_sentence = cleaned[0] + ("." if not cleaned[0].endswith(".") else "")
    if len(cleaned) > 1:
        second_sentence = cleaned[1] + ("." if not cleaned[1].endswith(".") else "")
    else:
        second_sentence = f"Immediate field team dispatch requested for {dept.lower()}."

    return f"{first_sentence} {second_sentence}"


def _classify_heuristic(transcript: str, captured_address: Optional[str]) -> ComplaintAnalysis:
    text_lower = (transcript or "").lower()

    if any(k in text_lower for k in ["water", "pipe", "drain", "sewer", "leak", "tap", "flood"]):
        dept = "Water Supply & Sewerage"
    elif any(k in text_lower for k in ["garbage", "waste", "trash", "clean", "dump", "sanitation"]):
        dept = "Sanitation & Solid Waste"
    elif any(k in text_lower for k in ["electric", "power", "light", "wire", "pole", "transformer", "dark"]):
        dept = "Electricity & Street Lighting"
    elif any(k in text_lower for k in ["road", "pothole", "street", "pavement", "bridge", "asphalt"]):
        dept = "Roads & Public Works"
    elif any(k in text_lower for k in ["traffic", "jam", "signal", "vehicle", "parking"]):
        dept = "Traffic Management"
    elif any(k in text_lower for k in ["bus", "metro", "transport", "train"]):
        dept = "Public Transport"
    elif any(k in text_lower for k in ["hospital", "disease", "fever", "health", "doctor", "medicine"]):
        dept = "Public Health"
    elif any(k in text_lower for k in ["fire", "disaster", "emergency", "collapse", "earthquake"]):
        dept = "Emergency & Disaster Management"
    elif any(k in text_lower for k in ["police", "crime", "theft", "safety", "fight", "robbery"]):
        dept = "Police & Public Safety"
    else:
        dept = "Municipal Services"

    urgency = "critical" if any(k in text_lower for k in ["danger", "fire", "burst", "emergency", "severe"]) else "medium"
    summary_text = _clean_transcript_to_summary(transcript, dept)

    return ComplaintAnalysis(
        summary=summary_text,
        sentiment="neutral",
        urgency=urgency,
        department=dept,
        location=captured_address or "City Center",
        tags=["civic", "complaint"],
        reasoning=f"Automated keyword classification assigned complaint to {dept}."
    )


def analyze_transcript(transcript: str, captured_address: Optional[str] = None) -> ComplaintAnalysis:
    settings = get_settings()

    location_instruction = (
        WITH_GPS_INSTRUCTION.format(captured_address=captured_address)
        if captured_address
        else WITHOUT_GPS_INSTRUCTION
    )

    if not settings.gemini_api_key or settings.gemini_api_key in ("change-me", "YOUR_GEMINI_API_KEY"):
        return _classify_heuristic(transcript, captured_address)

    # Valid model name supported by API key
    model_name = settings.gemini_model if settings.gemini_model else "gemini-flash-latest"

    def _call_gemini():
        last_err = None
        for attempt in range(3):
            try:
                response = _client().models.generate_content(
                    model=model_name,
                    contents=PROMPT_TEMPLATE.format(transcript=transcript, location_instruction=location_instruction),
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=ComplaintAnalysis,
                    ),
                )
                if response.parsed:
                    return response.parsed
            except Exception as e:
                last_err = e
                logger.warning("Gemini attempt %d failed (%s), retrying...", attempt + 1, e)
                time.sleep(0.4)
        if last_err:
            raise last_err
        raise RuntimeError("Gemini content generation failed")

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call_gemini)
            return future.result(timeout=15.0)
    except Exception as exc:
        logger.warning("Gemini API call timed out or failed (%s); using heuristic fallback", exc)
        return _classify_heuristic(transcript, captured_address)


def is_same_incident(summary_a: str, summary_b: str) -> bool:
    settings = get_settings()
    try:
        if not settings.gemini_api_key or settings.gemini_api_key in ("change-me", "YOUR_GEMINI_API_KEY"):
            raise ValueError("GEMINI_API_KEY not configured")

        model_name = settings.gemini_model if settings.gemini_model else "gemini-flash-latest"
        response = _client().models.generate_content(
            model=model_name,
            contents=DUPLICATE_PROMPT_TEMPLATE.format(summary_a=summary_a, summary_b=summary_b),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DuplicateCheck,
            ),
        )
        result: DuplicateCheck = response.parsed
        return result.same_incident
    except Exception as exc:
        logger.warning("Gemini API unavailable (%s); returning false for duplicate check", exc)
        return False
