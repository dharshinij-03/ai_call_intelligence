"""Fetches a complaint's AI analysis (department, priority) from call-analysis-service."""

from dataclasses import dataclass
from uuid import UUID

import httpx

from app.config import get_settings


class AnalysisNotFound(Exception):
    pass


@dataclass
class ComplaintAnalysis:
    department_name: str
    priority: str  # urgency: critical | high | medium | low
    summary: str


async def fetch_analysis(call_id: UUID) -> ComplaintAnalysis:
    settings = get_settings()
    url = f"{settings.call_analysis_service_url}/analysis/{call_id}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)

    if response.status_code == 404:
        raise AnalysisNotFound(
            f"Call {call_id} has no analysis yet — POST /analyze/{{call_id}} on "
            "call-analysis-service before routing it."
        )
    response.raise_for_status()

    data = response.json()
    return ComplaintAnalysis(
        department_name=data["department"],
        priority=data["urgency"],
        summary=data["summary"],
    )
