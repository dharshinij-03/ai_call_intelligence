from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import ComplaintStatusListOut, ComplaintStatusOut
from app.security import CurrentUser, require_role

router = APIRouter()


@router.get("/complaints/mine", response_model=ComplaintStatusListOut)
async def my_complaints(
    db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(require_role("citizen"))
):
    """A citizen's own complaints and their current status. Correlates a
    call_sessions row (owned by this service) to a calls row (owned by
    call-management-service) via calls.caller_id — the citizen's browser is
    expected to pass the call_session id as `caller_id` when it opens the
    transcription WebSocket, so no extra plumbing is needed to link the two."""
    rows = (
        (
            await db.execute(
                text(
                    """
                    SELECT
                        c.id AS call_id,
                        cs.id AS call_session_id,
                        cs.requested_at,
                        ca.department AS department_name,
                        ca.summary,
                        ca.urgency,
                        ca.sentiment,
                        ca.location,
                        upper(a.status::text) AS assignment_status,
                        a.officer_name,
                        a.sla_due_at
                    FROM call_sessions cs
                    JOIN calls c ON c.caller_id = cs.id::text
                    LEFT JOIN call_analysis ca ON ca.call_id = c.id
                    LEFT JOIN assignments a ON a.call_id = c.id
                    WHERE cs.citizen_id = :citizen_id
                    ORDER BY cs.requested_at DESC
                    """
                ),
                {"citizen_id": user.id},
            )
        )
        .mappings()
        .all()
    )
    return ComplaintStatusListOut(items=[ComplaintStatusOut(**row) for row in rows])
