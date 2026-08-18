from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.queries import get_department_summaries
from app.schemas import HeatmapCellOut, OverviewOut, TrendPointOut
from app.statuses import CLOSED_STATUSES, OPEN_STATUSES

router = APIRouter()


@router.get("/heatmap", response_model=List[HeatmapCellOut])
async def get_heatmap(db: AsyncSession = Depends(get_db)):
    """Location Metadata (PDF section 18) rolled up into Heat Map Metadata
    (section 32): complaints grouped into a ~100m grid (3 decimal places on
    lat/lng) with a count, critical count, and dominant department per
    cell — direct input for a map heatmap layer."""
    rows = (
        (
            await db.execute(
                text(
                    """
                    SELECT
                        round(coalesce(ca.latitude, c.latitude)::numeric, 3) AS latitude,
                        round(coalesce(ca.longitude, c.longitude)::numeric, 3) AS longitude,
                        count(*) AS complaint_count,
                        count(*) FILTER (WHERE ca.urgency = 'critical') AS critical_count,
                        mode() WITHIN GROUP (ORDER BY ca.department) AS dominant_department
                    FROM calls c
                    LEFT JOIN call_analysis ca ON ca.call_id = c.id
                    WHERE coalesce(ca.latitude, c.latitude) IS NOT NULL
                    GROUP BY 1, 2
                    """
                )
            )
        )
        .mappings()
        .all()
    )
    return [HeatmapCellOut(**row) for row in rows]


@router.get("/trends", response_model=List[TrendPointOut])
async def get_trends(
    days: int = Query(30, le=365),
    by_department: bool = Query(False, description="Break down each day by department instead of an overall total"),
    db: AsyncSession = Depends(get_db),
):
    """Daily complaint volume — Predictive Analytics Metadata (section 31)
    without the ML forecasting: historical counts a frontend can chart or
    feed into its own trend/anomaly logic."""
    group_col = "ca.department" if by_department else "NULL"
    rows = (
        (
            await db.execute(
                text(
                    f"""
                    SELECT
                        date_trunc('day', c.created_at)::date AS day,
                        {group_col} AS department_name,
                        count(*) AS count
                    FROM calls c
                    LEFT JOIN call_analysis ca ON ca.call_id = c.id
                    WHERE c.created_at >= now() - make_interval(days => :days)
                    GROUP BY 1, 2
                    ORDER BY 1
                    """
                ),
                {"days": days},
            )
        )
        .mappings()
        .all()
    )
    return [TrendPointOut(**row) for row in rows]


@router.get("/overview", response_model=OverviewOut)
async def get_overview(db: AsyncSession = Depends(get_db)):
    """Single-call dashboard summary: city-wide totals plus the same
    per-department breakdown as GET /departments."""
    totals = (
        await db.execute(
            text(
                """
                SELECT
                    count(*) AS total,
                    count(*) FILTER (WHERE upper(a.status::text) = ANY(:open)) AS open,
                    count(*) FILTER (WHERE upper(a.status::text) = ANY(:closed)) AS resolved,
                    count(*) FILTER (WHERE ca.urgency = 'critical') AS critical,
                    count(*) FILTER (WHERE ca.is_duplicate) AS duplicates,
                    count(*) FILTER (
                        WHERE a.sla_due_at < now() AND upper(a.status::text) != ALL(:closed)
                    ) AS sla_breaches
                FROM calls c
                LEFT JOIN call_analysis ca ON ca.call_id = c.id
                LEFT JOIN assignments a ON a.call_id = c.id
                """
            ),
            {"open": OPEN_STATUSES, "closed": CLOSED_STATUSES},
        )
    ).mappings().one()

    departments = await get_department_summaries(db)

    return OverviewOut(
        total_complaints=totals["total"],
        open_complaints=totals["open"],
        resolved_complaints=totals["resolved"],
        critical_complaints=totals["critical"],
        duplicate_complaints=totals["duplicates"],
        sla_breaches=totals["sla_breaches"],
        departments=departments,
    )
