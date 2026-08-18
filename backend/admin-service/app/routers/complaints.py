from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import ComplaintDetailOut, ComplaintListOut, ComplaintOut

router = APIRouter()

# calls.id is the join key everywhere ("call_id" downstream) — this view
# stitches together data four different services each own a slice of:
# call metadata + location (call-management-service), AI classification
# (call-analysis-service), and department/officer routing
# (complaint-assignment-service). LEFT JOINs throughout since a call may not
# have been analyzed or routed yet.
BASE_QUERY = """
    SELECT
        c.id AS call_id,
        c.source,
        c.status AS call_status,
        c.created_at,
        a.department_id,
        ca.department AS department_name,
        ca.sentiment,
        ca.urgency,
        ca.summary,
        ca.location,
        coalesce(ca.latitude, c.latitude) AS latitude,
        coalesce(ca.longitude, c.longitude) AS longitude,
        ca.tags,
        ca.is_duplicate,
        ca.duplicate_of_call_id,
        upper(a.status::text) AS assignment_status,
        a.officer_id,
        a.officer_name,
        a.sla_due_at,
        ca.reasoning,
        r.recommendation_text,
        upper(r.recommendation_type::text) AS recommendation_type,
        r.confidence AS recommendation_confidence,
        r.officer_action
    FROM calls c
    LEFT JOIN call_analysis ca ON ca.call_id = c.id
    LEFT JOIN assignments a ON a.call_id = c.id
    LEFT JOIN recommendations r ON r.call_id = c.id
"""


@router.get("/complaints", response_model=ComplaintListOut)
async def list_complaints(
    department_id: Optional[str] = None,
    status: Optional[str] = Query(None, description="Assignment status, e.g. ASSIGNED, RESOLVED"),
    officer_id: Optional[UUID] = None,
    is_duplicate: Optional[bool] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    where = []
    params: dict = {"limit": limit, "offset": offset}
    if department_id:
        where.append("a.department_id = :department_id")
        params["department_id"] = department_id
    if status:
        where.append("upper(a.status::text) = upper(:status)")
        params["status"] = status
    if officer_id:
        where.append("a.officer_id = :officer_id")
        params["officer_id"] = officer_id
    if is_duplicate is not None:
        where.append("ca.is_duplicate = :is_duplicate")
        params["is_duplicate"] = is_duplicate

    where_clause = f"WHERE {' AND '.join(where)}" if where else ""

    total = (
        await db.execute(
            text(f"SELECT count(*) FROM ({BASE_QUERY} {where_clause}) sub"), params
        )
    ).scalar_one()

    rows = (
        (
            await db.execute(
                text(f"{BASE_QUERY} {where_clause} ORDER BY c.created_at DESC LIMIT :limit OFFSET :offset"),
                params,
            )
        )
        .mappings()
        .all()
    )

    return ComplaintListOut(total=total, items=[ComplaintOut(**row) for row in rows])


@router.get("/complaints/{call_id}", response_model=ComplaintDetailOut)
async def get_complaint(call_id: UUID, db: AsyncSession = Depends(get_db)):
    row = (
        (await db.execute(text(f"{BASE_QUERY} WHERE c.id = :call_id"), {"call_id": call_id}))
        .mappings()
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return ComplaintDetailOut(**row)
