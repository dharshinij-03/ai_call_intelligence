from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Sentiment = Literal["distressed", "angry", "negative", "neutral", "positive"]
Urgency = Literal["critical", "high", "medium", "low"]

# The official 12-department taxonomy — see backend/asset/AI-Powered Citizen
# Call Intelligence Platform.pdf. Shared (by value, each service keeps its own
# copy) with user-management-service (officer.department) and
# complaint-assignment-service (routing/SLA tables).
Department = Literal[
    "Water Supply & Sewerage",
    "Sanitation & Solid Waste",
    "Roads & Public Works",
    "Electricity & Street Lighting",
    "Public Transport",
    "Traffic Management",
    "Public Health",
    "Emergency & Disaster Management",
    "Police & Public Safety",
    "Municipal Services",
    "Environment",
    "Revenue & Civic Administration",
]


class ComplaintAnalysis(BaseModel):
    """Schema handed to Gemini as response_schema — its fields double as the
    structured-extraction contract for every analyzed call."""

    summary: str = Field(description="A concise summary of the call in exactly two sentences, in English.")
    sentiment: Sentiment = Field(description="Overall emotional tone of the caller.")
    urgency: Urgency = Field(description="How urgently this needs a response.")
    department: Department = Field(
        description="Which of the 12 official civic departments should handle this complaint. "
        "If genuinely unclear, default to 'Municipal Services'."
    )
    location: Optional[str] = Field(
        default=None,
        description="A specific address, area, or landmark mentioned in the call. Null if none was mentioned — never guess.",
    )
    tags: List[str] = Field(description="Short lowercase keyword tags relevant to the complaint, e.g. ['fire', 'residential'].")
    reasoning: Optional[str] = Field(
        default=None, description="One sentence explaining why this department was chosen."
    )


class DuplicateCheck(BaseModel):
    """Schema handed to Gemini to confirm whether two complaints describe the
    same real-world incident, not just a similar category of problem."""

    same_incident: bool = Field(
        description="True only if both complaints are almost certainly reporting the same real-world event."
    )
    reason: str = Field(description="One sentence explaining the judgment.")


class CallAnalysisOut(ComplaintAnalysis):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    call_id: UUID
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_duplicate: bool = False
    duplicate_of_call_id: Optional[UUID] = None
    created_at: datetime
