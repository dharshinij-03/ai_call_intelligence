from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.departments import DEPARTMENTS, department_id_for_name, get_sla_hours
from app.models import Assignment, AssignmentStatus
from app.schemas import AssignmentOut, AssignmentStatusUpdate, DepartmentOut
from app.services import call_analysis_client, user_management_client

router = APIRouter()

OPEN_STATUSES = [
    AssignmentStatus.assigned,
    AssignmentStatus.in_progress,
    AssignmentStatus.pending_information,
    AssignmentStatus.reopened,
]


@router.get("/departments", response_model=List[DepartmentOut])
async def list_departments():
    return DEPARTMENTS


async def _pick_least_loaded_officer(db: AsyncSession, officer_ids: List[UUID]) -> UUID:
    """Picks whichever candidate officer currently has the fewest open
    assignments — a simple, DB-backed stand-in for the doc's officer
    `currentWorkload` field, always derived live rather than cached."""
    stmt = (
        select(Assignment.officer_id, func.count(Assignment.id))
        .where(Assignment.officer_id.in_(officer_ids), Assignment.status.in_(OPEN_STATUSES))
        .group_by(Assignment.officer_id)
    )
    counts = dict((await db.execute(stmt)).all())
    return min(officer_ids, key=lambda oid: counts.get(oid, 0))


import httpx

@router.post("/route/{call_id}", response_model=AssignmentOut)
async def route_complaint(call_id: UUID, db: AsyncSession = Depends(get_db)):
    """Forwards an analyzed complaint to its department and assigns it to
    whichever active officer in that department currently has the lightest
    load. Safe to call again on the same call — re-routes rather than
    duplicating (useful if the department/priority changed on re-analysis,
    or to retry after a department briefly had zero officers)."""
    try:
        analysis = await call_analysis_client.fetch_analysis(call_id)
    except call_analysis_client.AnalysisNotFound:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                await client.post(f"http://127.0.0.1:8002/analyze/{call_id}")
            analysis = await call_analysis_client.fetch_analysis(call_id)
        except Exception as exc:
            raise HTTPException(status_code=404, detail=f"Analysis for call {call_id} not found: {exc}") from exc

    department_id = department_id_for_name(analysis.department_name)
    if department_id is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unrecognized department '{analysis.department_name}' — not one of the 12 official departments.",
        )

    officers = await user_management_client.fetch_available_officers(analysis.department_name)

    now = datetime.now(timezone.utc)
    sla_due_at = now + timedelta(hours=get_sla_hours(department_id, analysis.priority))

    officer_id: Optional[UUID] = None
    officer_name: Optional[str] = None
    status = AssignmentStatus.unassigned
    assigned_at = None

    if officers:
        chosen_id = await _pick_least_loaded_officer(db, [o.id for o in officers])
        chosen = next(o for o in officers if o.id == chosen_id)
        officer_id, officer_name = chosen.id, chosen.full_name
        status = AssignmentStatus.assigned
        assigned_at = now

    existing = await db.scalar(select(Assignment).where(Assignment.call_id == call_id))
    if existing:
        existing.department_id = department_id
        existing.department_name = analysis.department_name
        existing.priority = analysis.priority
        existing.officer_id = officer_id
        existing.officer_name = officer_name
        existing.status = status
        existing.sla_due_at = sla_due_at
        existing.assigned_at = assigned_at
        record = existing
    else:
        record = Assignment(
            call_id=call_id,
            department_id=department_id,
            department_name=analysis.department_name,
            priority=analysis.priority,
            officer_id=officer_id,
            officer_name=officer_name,
            status=status,
            sla_due_at=sla_due_at,
            assigned_at=assigned_at,
        )
        db.add(record)

    await db.commit()
    await db.refresh(record)
    return record


@router.get("/assignments/{call_id}", response_model=AssignmentOut)
async def get_assignment(call_id: UUID, db: AsyncSession = Depends(get_db)):
    record = await db.scalar(select(Assignment).where(Assignment.call_id == call_id))
    if record is None:
        raise HTTPException(status_code=404, detail="No assignment found for this call")
    return record


@router.get("/assignments", response_model=List[AssignmentOut])
async def list_assignments(
    department_id: Optional[str] = None,
    officer_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Assignment)
    if department_id:
        stmt = stmt.where(Assignment.department_id == department_id)
    if officer_id:
        stmt = stmt.where(Assignment.officer_id == officer_id)
    if status:
        stmt = stmt.where(Assignment.status == status)
    return (await db.scalars(stmt.order_by(Assignment.created_at.desc()))).all()


@router.patch("/assignments/{call_id}", response_model=AssignmentOut)
async def update_assignment_status(
    call_id: UUID, payload: AssignmentStatusUpdate, db: AsyncSession = Depends(get_db)
):
    record = await db.scalar(select(Assignment).where(Assignment.call_id == call_id))
    if record is None:
        raise HTTPException(status_code=404, detail="No assignment found for this call")

    record.status = payload.status
    await db.commit()
    await db.refresh(record)
    return record
