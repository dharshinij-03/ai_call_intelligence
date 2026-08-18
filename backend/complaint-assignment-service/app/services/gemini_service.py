"""Wraps Gemini to generate an officer-facing fix recommendation — the
'Officer Copilot' feature from the source PDF (section 30)."""

from functools import lru_cache

from google import genai
from google.genai import types

from app.config import get_settings
from app.schemas import FixRecommendation

PROMPT_TEMPLATE = """You are an assistant helping a civic department officer resolve a citizen \
complaint. Based on the details below, recommend the single best next action for the officer to take.

Be specific to this complaint, not generic ("dispatch a team to inspect the reported water leak on \
Main Road", not "investigate the issue"). Do not recommend anything beyond what a field officer or \
their team could reasonably do — no policy changes, no long-term infrastructure projects.

Department: {department}
Priority: {priority}
Complaint summary: {summary}
"""


@lru_cache
def _client() -> genai.Client:
    settings = get_settings()
    return genai.Client(api_key=settings.gemini_api_key)


def generate_recommendation(department: str, priority: str, summary: str) -> FixRecommendation:
    settings = get_settings()
    response = _client().models.generate_content(
        model=settings.gemini_model,
        contents=PROMPT_TEMPLATE.format(department=department, priority=priority, summary=summary),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=FixRecommendation,
        ),
    )
    return response.parsed
