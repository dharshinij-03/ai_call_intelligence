"""Call queue + WebRTC signaling relay.

This service never touches audio. Citizen and operator browsers establish a
direct WebRTC peer connection between themselves; this router only does
matchmaking (who's waiting, who accepted whom) and relays opaque SDP/ICE
messages between the two browsers so they can negotiate that connection.
State is in-process (plain Python dicts/sets) — fine for a single-process
hackathon deployment; a multi-worker deployment would need this in Redis
pub/sub instead.
"""

from datetime import datetime, timezone
from typing import Dict, List, Set
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CallSession, CallSessionStatus
from app.schemas import CallSessionOut, CallRequestIn
from app.security import CurrentUser, get_current_user, get_current_user_ws, require_role

router = APIRouter()

# Operators currently watching the live queue.
operator_queue_sockets: Set[WebSocket] = set()

# call_session_id -> {"citizen": ws, "operator": ws}
signal_sockets: Dict[UUID, Dict[str, WebSocket]] = {}


async def _broadcast_to_queue(message: dict) -> None:
    dead = set()
    for ws in operator_queue_sockets:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    operator_queue_sockets.difference_update(dead)


@router.post("/calls/request", response_model=CallSessionOut, status_code=status.HTTP_201_CREATED)
async def request_call(
    call_request: CallRequestIn,
    db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(require_role("citizen"))
):
    session = CallSession(
        citizen_id=user.id,
        citizen_name=user.name,
        status=CallSessionStatus.waiting,
        latitude=call_request.latitude,
        longitude=call_request.longitude,
        location_accuracy=call_request.location_accuracy,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    await _broadcast_to_queue(
        {
            "type": "call_waiting",
            "call_session_id": str(session.id),
            "citizen_name": session.citizen_name,
            "requested_at": session.requested_at.isoformat(),
        }
    )
    return session


@router.get("/calls/queue", response_model=List[CallSessionOut])
async def get_queue(
    db: AsyncSession = Depends(get_db), _user: CurrentUser = Depends(require_role("operator", "admin"))
):
    result = await db.scalars(
        select(CallSession)
        .where(CallSession.status == CallSessionStatus.waiting)
        .order_by(CallSession.requested_at)
    )
    return result.all()


@router.post("/calls/{call_session_id}/accept", response_model=CallSessionOut)
async def accept_call(
    call_session_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_role("operator")),
):
    session = await db.get(CallSession, call_session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call session not found")
    if session.status != CallSessionStatus.waiting:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Call already claimed or ended")

    session.operator_id = user.id
    session.operator_name = user.name
    session.status = CallSessionStatus.connected
    session.connected_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)

    await _broadcast_to_queue({"type": "call_claimed", "call_session_id": str(session.id)})
    return session


@router.post("/calls/{call_session_id}/end", response_model=CallSessionOut)
async def end_call(
    call_session_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    session = await db.get(CallSession, call_session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call session not found")
    if user.id not in (session.citizen_id, session.operator_id) and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this call")

    if session.status not in (CallSessionStatus.ended, CallSessionStatus.cancelled):
        session.status = CallSessionStatus.ended if session.operator_id else CallSessionStatus.cancelled
        session.ended_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(session)

    peers = signal_sockets.get(call_session_id, {})
    for ws in list(peers.values()):
        try:
            await ws.send_json({"type": "hangup"})
        except Exception:
            pass
    return session


@router.websocket("/ws/operator-queue")
async def operator_queue_ws(websocket: WebSocket, token: str):
    user = await get_current_user_ws(websocket, token)
    if user.role not in ("operator", "admin"):
        await websocket.close(code=4403, reason="Operators only")
        return

    await websocket.accept()
    operator_queue_sockets.add(websocket)
    try:
        while True:
            # Queue is push-only from the server; we just need the connection
            # to stay open. Any client message is ignored (could be a ping).
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        operator_queue_sockets.discard(websocket)


@router.websocket("/ws/signal/{call_session_id}")
async def signal_ws(websocket: WebSocket, call_session_id: UUID, token: str):
    user = await get_current_user_ws(websocket, token)

    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        session = await db.get(CallSession, call_session_id)

    if session is None:
        await websocket.close(code=4404, reason="Call session not found")
        return

    if user.id == session.citizen_id:
        role = "citizen"
    elif user.id == session.operator_id:
        role = "operator"
    else:
        await websocket.close(code=4403, reason="Not a participant in this call")
        return

    await websocket.accept()
    signal_sockets.setdefault(call_session_id, {})[role] = websocket

    other_role = "operator" if role == "citizen" else "citizen"
    other_ws = signal_sockets[call_session_id].get(other_role)
    if other_ws is not None:
        await other_ws.send_json({"type": "peer_joined"})
        await websocket.send_json({"type": "peer_joined"})

    try:
        while True:
            message = await websocket.receive_json()
            other_ws = signal_sockets.get(call_session_id, {}).get(other_role)
            if other_ws is not None:
                await other_ws.send_json(message)
    except WebSocketDisconnect:
        pass
    finally:
        if signal_sockets.get(call_session_id, {}).get(role) is websocket:
            del signal_sockets[call_session_id][role]
        other_ws = signal_sockets.get(call_session_id, {}).get(other_role)
        if other_ws is not None:
            try:
                await other_ws.send_json({"type": "peer_left"})
            except Exception:
                pass
