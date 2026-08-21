from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CitizenFeedback
from app.schemas import ComplaintFeedbackIn, ComplaintStatusListOut, ComplaintStatusOut
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
                        a.sla_due_at,
                        (cf.id IS NOT NULL) AS feedback_submitted,
                        cf.rating AS feedback_rating,
                        cf.comments AS feedback_comments
                    FROM call_sessions cs
                    JOIN calls c ON c.caller_id = cs.id::text
                    LEFT JOIN call_analysis ca ON ca.call_id = c.id
                    LEFT JOIN assignments a ON a.call_id = c.id
                    LEFT JOIN citizen_feedback cf ON cf.call_id = c.id AND cf.citizen_id = cs.citizen_id
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


@router.post("/complaints/{call_id}/feedback")
async def submit_feedback(
    call_id: UUID,
    payload: ComplaintFeedbackIn,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_role("citizen")),
):
    # Ensure this call belongs to the current citizen and is resolved/closed.
    row = (
        await db.execute(
            text(
                """
                SELECT upper(a.status::text) AS assignment_status
                FROM calls c
                JOIN call_sessions cs ON c.caller_id = cs.id::text
                LEFT JOIN assignments a ON a.call_id = c.id
                WHERE c.id = :call_id AND cs.citizen_id = :citizen_id
                """
            ),
            {"call_id": call_id, "citizen_id": user.id},
        )
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail="Complaint not found for this citizen")

    status = (row.get("assignment_status") or "").upper()
    if status not in {"RESOLVED", "CLOSED"}:
        raise HTTPException(status_code=409, detail="Feedback is allowed only after resolution")

    existing = (
        await db.execute(
            text(
                """
                SELECT id
                FROM citizen_feedback
                WHERE call_id = :call_id AND citizen_id = :citizen_id
                """
            ),
            {"call_id": call_id, "citizen_id": user.id},
        )
    ).mappings().first()

    if existing is None:
        db.add(
            CitizenFeedback(
                call_id=call_id,
                citizen_id=user.id,
                rating=payload.rating,
                comments=payload.comments,
            )
        )
    else:
        await db.execute(
            text(
                """
                UPDATE citizen_feedback
                SET rating = :rating, comments = :comments, updated_at = now()
                WHERE call_id = :call_id AND citizen_id = :citizen_id
                """
            ),
            {
                "rating": payload.rating,
                "comments": payload.comments,
                "call_id": call_id,
                "citizen_id": user.id,
            },
        )

    await db.commit()
    return {"ok": True}
