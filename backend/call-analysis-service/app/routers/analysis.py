from typing import List
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import CallAnalysis
from app.schemas import CallAnalysisOut
from app.services import call_management_client, duplicate_service, gemini_service

router = APIRouter()


async def _resolve_cm_uuid(call_id: str) -> UUID:
    """Resolve a call ID (either CM UUID or citizen session ID) to the CM call UUID."""
    settings = get_settings()
    base = settings.call_management_service_url

    try:
        call_uuid = UUID(call_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid call_id format")

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Try direct UUID lookup first
        r = await client.get(f"{base}/calls/{call_id}")
        if r.status_code == 200:
            return UUID(r.json()["id"])

        # Try by caller_id (citizen session ID)
        r2 = await client.get(f"{base}/calls/by-caller/{call_id}")
        if r2.status_code == 200:
            return UUID(r2.json()["id"])

    raise HTTPException(status_code=404, detail=f"Call {call_id} not found in call-management-service")


@router.post("/analyze/{call_id}", response_model=CallAnalysisOut)
async def analyze_call(call_id: str, db: AsyncSession = Depends(get_db)):
    """Analyze a call and generate an AI summary.
    
    Accepts either the call-management-service UUID or the citizen-service session UUID.
    """
    try:
        call_uuid = UUID(call_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid call_id format")

    # Fetch transcript context (handles both UUID and caller_id automatically)
    try:
        context = await call_management_client.fetch_call_context(call_uuid)
    except call_management_client.CallNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    # Resolve to the true CM call UUID (may differ from the caller_id UUID)
    resolved_call_uuid = await _resolve_cm_uuid(call_id)

    # Run AI analysis
    result = gemini_service.analyze_transcript(context.transcript, context.captured_address)

    # Check for duplicate complaints
    duplicate = await duplicate_service.find_duplicate(
        db,
        exclude_call_id=resolved_call_uuid,
        department=result.department,
        summary=result.summary,
        latitude=context.latitude,
        longitude=context.longitude,
    )
    duplicate_of_call_id = None
    if duplicate is not None:
        duplicate_of_call_id = duplicate.duplicate_of_call_id or duplicate.call_id

    field_values = {
        **result.model_dump(),
        "latitude": context.latitude,
        "longitude": context.longitude,
        "is_duplicate": duplicate_of_call_id is not None,
        "duplicate_of_call_id": duplicate_of_call_id,
        "transcript_snapshot": context.transcript,
    }

    # Upsert analysis record
    existing = await db.scalar(select(CallAnalysis).where(CallAnalysis.call_id == resolved_call_uuid))
    if existing:
        for field, value in field_values.items():
            setattr(existing, field, value)
        record = existing
    else:
        record = CallAnalysis(call_id=resolved_call_uuid, **field_values)
        db.add(record)

    await db.commit()
    await db.refresh(record)
    return record


@router.get("/analysis/{call_id}", response_model=CallAnalysisOut)
async def get_analysis(call_id: str, db: AsyncSession = Depends(get_db)):
    """Get existing analysis for a call. Accepts both CM UUID and citizen session UUID."""
    try:
        call_uuid = UUID(call_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid call_id")

    # Try direct UUID match
    record = await db.scalar(select(CallAnalysis).where(CallAnalysis.call_id == call_uuid))

    if record is None:
        # Try resolving via caller_id → CM UUID
        try:
            resolved_uuid = await _resolve_cm_uuid(call_id)
            if resolved_uuid != call_uuid:
                record = await db.scalar(
                    select(CallAnalysis).where(CallAnalysis.call_id == resolved_uuid)
                )
        except HTTPException:
            pass

    if record is None:
        raise HTTPException(status_code=404, detail="No analysis found for this call")
    return record


@router.get("/duplicates/{call_id}", response_model=List[CallAnalysisOut])
async def list_duplicates(call_id: UUID, db: AsyncSession = Depends(get_db)):
    """Every complaint linked to the same underlying incident as this call."""
    record = await db.scalar(select(CallAnalysis).where(CallAnalysis.call_id == call_id))
    if record is None:
        raise HTTPException(status_code=404, detail="No analysis found for this call")

    root_call_id = record.duplicate_of_call_id or record.call_id
    stmt = select(CallAnalysis).where(
        or_(CallAnalysis.call_id == root_call_id, CallAnalysis.duplicate_of_call_id == root_call_id)
    )
    return (await db.scalars(stmt)).all()
