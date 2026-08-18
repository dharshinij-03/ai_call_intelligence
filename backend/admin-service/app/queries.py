"""Query helpers shared by more than one router."""

from typing import List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.departments import DEPARTMENTS
from app.schemas import DepartmentSummaryOut
from app.statuses import CLOSED_STATUSES, OPEN_STATUSES


async def get_department_summaries(db: AsyncSession) -> List[DepartmentSummaryOut]:
    assignment_counts = (
        (
            await db.execute(
                text(
                    """
                    SELECT department_id,
                           count(*) AS total,
                           count(*) FILTER (WHERE upper(status::text) = ANY(:open)) AS open,
                           count(*) FILTER (WHERE upper(status::text) = ANY(:closed)) AS resolved,
                           count(*) FILTER (WHERE priority = 'critical') AS critical,
                           count(*) FILTER (
                               WHERE sla_due_at < now() AND upper(status::text) != ALL(:closed)
                           ) AS sla_breaches
                    FROM assignments
                    GROUP BY department_id
                    """
                ),
                {"open": OPEN_STATUSES, "closed": CLOSED_STATUSES},
            )
        )
        .mappings()
        .all()
    )
    counts_by_dept = {row["department_id"]: row for row in assignment_counts}

    officer_counts = (
        (
            await db.execute(
                text(
                    "SELECT department, count(*) AS n FROM users "
                    "WHERE role = 'officer' AND is_active = true GROUP BY department"
                )
            )
        )
        .mappings()
        .all()
    )
    officers_by_dept_name = {row["department"]: row["n"] for row in officer_counts}

    results = []
    for dept in DEPARTMENTS:
        counts = counts_by_dept.get(dept["id"])
        results.append(
            DepartmentSummaryOut(
                id=dept["id"],
                code=dept["code"],
                name=dept["name"],
                officer_count=officers_by_dept_name.get(dept["name"], 0),
                total_complaints=counts["total"] if counts else 0,
                open_complaints=counts["open"] if counts else 0,
                resolved_complaints=counts["resolved"] if counts else 0,
                critical_complaints=counts["critical"] if counts else 0,
                sla_breaches=counts["sla_breaches"] if counts else 0,
            )
        )
    return results
