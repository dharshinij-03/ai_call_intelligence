from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.departments import ID_TO_DEPARTMENT
from app.queries import get_department_summaries
from app.schemas import DepartmentSummaryOut, OfficerSummaryOut
from app.statuses import CLOSED_STATUSES, OPEN_STATUSES

router = APIRouter()


@router.get("/departments", response_model=List[DepartmentSummaryOut])
async def list_departments(db: AsyncSession = Depends(get_db)):
    """All 12 departments with live complaint + officer counts — the
    department master + Department Performance Metadata from the PDF
    (sections 2, 28), computed straight from current data rather than
    a cached rollup."""
    return await get_department_summaries(db)


@router.get("/departments/{department_id}/officers", response_model=List[OfficerSummaryOut])
async def list_department_officers(department_id: str, db: AsyncSession = Depends(get_db)):
    """Officers under one department with live workload/performance —
    Officer Metadata from the PDF (section 27)."""
    dept = ID_TO_DEPARTMENT.get(department_id)
    if dept is None:
        raise HTTPException(status_code=404, detail=f"Unknown department_id '{department_id}'")

    officers = (
        (
            await db.execute(
                text(
                    "SELECT id, full_name, email, department, is_active FROM users "
                    "WHERE role = 'officer' AND department = :department ORDER BY full_name"
                ),
                {"department": dept["name"]},
            )
        )
        .mappings()
        .all()
    )
    if not officers:
        return []

    officer_ids = [o["id"] for o in officers]
    # avg_resolution_hours / sla_compliance_pct use `updated_at` as a proxy
    # for "when it was resolved" — assignments has no dedicated resolved_at
    # column, and updated_at technically changes on any field edit, not only
    # a status transition to RESOLVED/CLOSED. Good enough for a hackathon
    # metric, but a real resolved_at timestamp would make this exact.
    stats = (
        (
            await db.execute(
                text(
                    """
                    SELECT officer_id,
                           count(*) FILTER (WHERE upper(status::text) = ANY(:open)) AS open_workload,
                           count(*) FILTER (WHERE upper(status::text) = ANY(:closed)) AS resolved_count,
                           avg(
                               extract(epoch FROM (updated_at - created_at)) / 3600.0
                           ) FILTER (WHERE upper(status::text) = ANY(:closed)) AS avg_resolution_hours,
                           count(*) FILTER (
                               WHERE upper(status::text) = ANY(:closed) AND updated_at <= sla_due_at
                           ) AS within_sla,
                           count(*) FILTER (WHERE upper(status::text) = ANY(:closed)) AS resolved_total
                    FROM assignments
                    WHERE officer_id = ANY(:officer_ids)
                    GROUP BY officer_id
                    """
                ),
                {"open": OPEN_STATUSES, "closed": CLOSED_STATUSES, "officer_ids": officer_ids},
            )
        )
        .mappings()
        .all()
    )
    stats_by_officer = {row["officer_id"]: row for row in stats}

    results = []
    for o in officers:
        s = stats_by_officer.get(o["id"])
        resolved_total = s["resolved_total"] if s else 0
        sla_compliance = (s["within_sla"] / resolved_total * 100) if s and resolved_total else None
        results.append(
            OfficerSummaryOut(
                id=o["id"],
                full_name=o["full_name"],
                email=o["email"],
                department=o["department"],
                is_active=o["is_active"],
                open_workload=s["open_workload"] if s else 0,
                resolved_count=s["resolved_count"] if s else 0,
                avg_resolution_hours=s["avg_resolution_hours"] if s else None,
                sla_compliance_pct=sla_compliance,
            )
        )
    return results
