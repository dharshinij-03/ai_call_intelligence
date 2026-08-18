from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Recommendation
from app.schemas import RecommendationOut, RecommendationReview
from app.services import call_analysis_client, gemini_service

router = APIRouter()


@router.post("/recommendations/{call_id}", response_model=RecommendationOut)
async def generate_recommendation(call_id: UUID, db: AsyncSession = Depends(get_db)):
    """Generates (or regenerates) an AI fix recommendation for an officer,
    from the complaint's department/priority/summary via call-analysis-service."""
    try:
        analysis = await call_analysis_client.fetch_analysis(call_id)
    except call_analysis_client.AnalysisNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    result = gemini_service.generate_recommendation(
        department=analysis.department_name, priority=analysis.priority, summary=analysis.summary
    )

    existing = await db.scalar(select(Recommendation).where(Recommendation.call_id == call_id))
    if existing:
        existing.recommendation_text = result.recommendation_text
        existing.recommendation_type = result.recommendation_type
        existing.confidence = result.confidence
        existing.generated_at = datetime.now(timezone.utc)
        # Regenerating clears any prior officer review — it's a new suggestion.
        existing.accepted_by_officer = None
        existing.officer_action = None
        record = existing
    else:
        record = Recommendation(
            call_id=call_id,
            recommendation_text=result.recommendation_text,
            recommendation_type=result.recommendation_type,
            confidence=result.confidence,
            generated_at=datetime.now(timezone.utc),
        )
        db.add(record)

    await db.commit()
    await db.refresh(record)
    return record


@router.get("/recommendations/{call_id}", response_model=RecommendationOut)
async def get_recommendation(call_id: UUID, db: AsyncSession = Depends(get_db)):
    record = await db.scalar(select(Recommendation).where(Recommendation.call_id == call_id))
    if record is None:
        raise HTTPException(status_code=404, detail="No recommendation generated for this call yet")
    return record


@router.patch("/recommendations/{call_id}", response_model=RecommendationOut)
async def review_recommendation(
    call_id: UUID, payload: RecommendationReview, db: AsyncSession = Depends(get_db)
):
    """Officer accepts/rejects the recommendation and optionally records what
    action they actually took — matches acceptedByOfficer/officerAction in the source PDF."""
    record = await db.scalar(select(Recommendation).where(Recommendation.call_id == call_id))
    if record is None:
        raise HTTPException(status_code=404, detail="No recommendation generated for this call yet")

    record.accepted_by_officer = payload.accepted_by_officer
    record.officer_action = payload.officer_action

    await db.commit()
    await db.refresh(record)
    return record
