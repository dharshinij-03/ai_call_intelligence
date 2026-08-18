"""Live call transcription over WebSocket.

Expected client contract: the caller (your own WebRTC/VoIP app or gateway)
connects here and sends binary frames of 16kHz mono LINEAR16 (PCM16) audio,
or text JSON frames with client speech recognition transcripts.

The server streams interim/final transcripts + English translations back
as JSON text frames, and persists each final segment to Postgres.

Operator mode: connect with listen_only=true&call_id=<session_id> to listen
to transcripts without sending audio (does not create a new call).
Operators receive transcripts in real time via in-memory pub/sub — no DB poll lag.
"""

import asyncio
import json
import logging
import queue
import threading
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import Call, CallSource, CallStatus, TranscriptSegment
from app.services import geocoding, whisper_speech_service as speech_service, translate_service

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory pub/sub hub: key -> list of operator asyncio.Queue objects
# ---------------------------------------------------------------------------
_listeners: Dict[str, List[asyncio.Queue]] = defaultdict(list)
_listeners_lock = asyncio.Lock()


async def _broadcast(caller_id: str, payload: dict) -> None:
    """Push a JSON payload to every operator listening on caller_id."""
    if not caller_id:
        return
    async with _listeners_lock:
        queues = list(_listeners.get(caller_id, []))
    for q in queues:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


async def _add_listener(caller_id: str, q: asyncio.Queue) -> None:
    async with _listeners_lock:
        _listeners[caller_id].append(q)


async def _remove_listener(caller_id: str, q: asyncio.Queue) -> None:
    async with _listeners_lock:
        try:
            _listeners[caller_id].remove(q)
        except ValueError:
            pass
        if not _listeners[caller_id]:
            _listeners.pop(caller_id, None)


async def _geocode_and_store(call_id, latitude: float, longitude: float) -> None:
    address = await geocoding.reverse_geocode(latitude, longitude)
    if not address:
        return
    async with AsyncSessionLocal() as db:
        db_call = await db.get(Call, call_id)
        if db_call:
            db_call.address = address
            await db.commit()


async def _trigger_analysis_and_routing(call_id: UUID) -> None:
    """Auto-triggers AI analysis and complaint routing when a call finishes."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 1. Trigger Call Analysis Service (port 8002)
            res_analysis = await client.post(f"http://127.0.0.1:8002/analyze/{call_id}")
            logger.info("Auto-analysis for call %s: status %s", call_id, res_analysis.status_code)

            # 2. Trigger Complaint Assignment Service (port 8004)
            res_route = await client.post(f"http://127.0.0.1:8004/route/{call_id}")
            logger.info("Auto-routing for call %s: status %s", call_id, res_route.status_code)
    except Exception:
        logger.exception("Failed to auto-trigger analysis & routing for call %s", call_id)


@router.websocket("/calls/live")
async def live_call_socket(
    websocket: WebSocket,
    language_code: Optional[str] = Query(None),
    caller_id: Optional[str] = Query(None),
    call_id: Optional[str] = Query(None),
    listen_only: bool = Query(False),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
):
    await websocket.accept()
    settings = get_settings()

    # ------------------------------------------------------------------
    # OPERATOR / LISTEN-ONLY MODE
    # ------------------------------------------------------------------
    if listen_only and call_id:
        resolved_call_id = None
        resolved_caller_id = call_id

        async with AsyncSessionLocal() as db:
            stmt = (
                select(Call)
                .where(Call.caller_id == call_id, Call.status == CallStatus.live)
                .order_by(Call.created_at.desc())
            )
            result = await db.execute(stmt)
            call_row = result.scalars().first()
            if call_row is None:
                try:
                    call_uuid = UUID(call_id)
                except (ValueError, TypeError):
                    call_uuid = None
                if call_uuid is not None:
                    call_row = await db.get(Call, call_uuid)
            if call_row is not None:
                resolved_call_id = call_row.id
                resolved_caller_id = call_row.caller_id or call_id

        # If call not in DB yet, wait up to 30s for it to appear
        if resolved_call_id is None:
            await websocket.send_json(
                {"type": "started", "call_id": call_id, "mode": "listen", "waiting": True}
            )
            try:
                for _ in range(60):  # ~30s
                    await asyncio.sleep(0.5)
                    async with AsyncSessionLocal() as db:
                        stmt = (
                            select(Call)
                            .where(Call.caller_id == call_id, Call.status == CallStatus.live)
                            .order_by(Call.created_at.desc())
                        )
                        result = await db.execute(stmt)
                        call_row = result.scalars().first()
                        if call_row is not None:
                            resolved_call_id = call_row.id
                            resolved_caller_id = call_row.caller_id or call_id
                            break
            except WebSocketDisconnect:
                return

        if resolved_call_id is None:
            await websocket.send_json(
                {"type": "error", "message": "No live call found for this session"}
            )
            await websocket.close()
            return

        await websocket.send_json(
            {"type": "started", "call_id": str(resolved_call_id), "mode": "listen"}
        )

        # Send catch-up segments from DB
        try:
            async with AsyncSessionLocal() as db:
                stmt = (
                    select(TranscriptSegment)
                    .where(TranscriptSegment.call_id == resolved_call_id)
                    .order_by(TranscriptSegment.sequence)
                )
                result = await db.execute(stmt)
                for seg in result.scalars().all():
                    await websocket.send_json({
                        "type": "final",
                        "sequence": seg.sequence,
                        "detected_language": seg.detected_language,
                        "original_text": seg.original_text,
                        "translated_text": seg.translated_text,
                    })
        except Exception:
            logger.exception("Error sending catch-up segments for call %s", resolved_call_id)

        # Subscribe to pub/sub channels (by session id AND by call UUID)
        listener_q: asyncio.Queue = asyncio.Queue(maxsize=500)
        await _add_listener(resolved_caller_id, listener_q)
        if str(resolved_call_id) != resolved_caller_id:
            await _add_listener(str(resolved_call_id), listener_q)

        idle_check_counter = 0

        try:
            while True:
                try:
                    payload = await asyncio.wait_for(listener_q.get(), timeout=2.0)
                    await websocket.send_json(payload)
                    idle_check_counter = 0
                except asyncio.TimeoutError:
                    idle_check_counter += 1
                    if idle_check_counter >= 5:
                        idle_check_counter = 0
                        async with AsyncSessionLocal() as db:
                            call_row = await db.get(Call, resolved_call_id)
                            if call_row and call_row.status == CallStatus.completed:
                                await websocket.send_json({"type": "call_ended"})
                                break

        except WebSocketDisconnect:
            pass
        finally:
            await _remove_listener(resolved_caller_id, listener_q)
            if str(resolved_call_id) != resolved_caller_id:
                await _remove_listener(str(resolved_call_id), listener_q)
            try:
                await websocket.close()
            except Exception:
                pass
        return

    # ------------------------------------------------------------------
    # CITIZEN / NORMAL AUDIO MODE
    # ------------------------------------------------------------------
    lang = language_code or settings.default_language_code

    async with AsyncSessionLocal() as db:
        call = Call(
            source=CallSource.live,
            status=CallStatus.live,
            caller_id=caller_id,
            primary_language=lang,
            latitude=lat,
            longitude=lng,
            started_at=datetime.now(timezone.utc),
        )
        db.add(call)
        await db.commit()
        await db.refresh(call)

    await websocket.send_json({"type": "started", "call_id": str(call.id)})

    if lat is not None and lng is not None:
        asyncio.create_task(_geocode_and_store(call.id, lat, lng))

    audio_queue: "queue.Queue[Optional[bytes]]" = queue.Queue()
    response_queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()
    next_sequence = 0
    has_client_transcript = False
    alt_languages = speech_service.build_alternate_languages(lang, settings.alternative_language_codes)

    def run_streaming():
        try:
            for response in speech_service.streaming_recognize(
                audio_queue, lang, alt_languages
            ):
                asyncio.run_coroutine_threadsafe(response_queue.put(response), loop)
        except Exception as exc:
            asyncio.run_coroutine_threadsafe(response_queue.put(exc), loop)
        finally:
            asyncio.run_coroutine_threadsafe(response_queue.put(None), loop)

    worker_thread = threading.Thread(target=run_streaming, daemon=True)
    worker_thread.start()

    async def handle_responses():
        nonlocal next_sequence
        while True:
            item = await response_queue.get()
            if item is None:
                break
            if isinstance(item, Exception):
                err_msg = {"type": "error", "message": str(item)}
                try:
                    await websocket.send_json(err_msg)
                except Exception:
                    pass
                await _broadcast(caller_id or "", err_msg)
                await _broadcast(str(call.id), err_msg)
                break

            err = getattr(item, "error", None)
            err_code = getattr(err, "code", 0) if err is not None else 0
            if err_code:
                logger.error("Streaming recognize error for call %s: %s", call.id, getattr(err, "message", err))
                msg = {"type": "error", "message": str(getattr(err, "message", err))}
                try:
                    await websocket.send_json(msg)
                except Exception:
                    pass
                await _broadcast(caller_id or "", msg)
                await _broadcast(str(call.id), msg)
                break

            for result in item.results:
                if not result.alternatives:
                    continue
                alt = result.alternatives[0]
                text = alt.transcript

                if not result.is_final:
                    interim_payload = {"type": "interim", "original_text": text}
                    try:
                        await websocket.send_json(interim_payload)
                    except Exception:
                        pass
                    await _broadcast(caller_id or "", interim_payload)
                    await _broadcast(str(call.id), interim_payload)
                    continue

                try:
                    detected_lang = result.language_code or lang
                    translation = translate_service.translate_to_english(text, detected_lang)
                    seq = next_sequence
                    next_sequence += 1

                    # If client Web Speech API is actively providing transcripts, do not write lower-accuracy Whisper audio chunks to DB
                    if not has_client_transcript:
                        async with AsyncSessionLocal() as db:
                            db.add(
                                TranscriptSegment(
                                    call_id=call.id,
                                    sequence=seq,
                                    detected_language=detected_lang,
                                    original_text=text,
                                    translated_text=translation["translated_text"],
                                    confidence=0.70,
                                    is_final=True,
                                )
                            )
                            await db.commit()
                except Exception:
                    logger.exception("Failed to process final segment for call %s", call.id)
                    try:
                        await websocket.send_json(
                            {"type": "error", "message": "Failed to process a segment; continuing."}
                        )
                    except Exception:
                        pass
                    continue

                final_payload = {
                    "type": "final",
                    "sequence": seq,
                    "detected_language": detected_lang,
                    "original_text": text,
                    "translated_text": translation["translated_text"],
                }
                try:
                    await websocket.send_json(final_payload)
                except Exception:
                    pass
                await _broadcast(caller_id or "", final_payload)
                await _broadcast(str(call.id), final_payload)

    responses_task = asyncio.create_task(handle_responses())

    try:
        audio_chunk_count = 0
        total_bytes = 0
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                logger.info("WebSocket disconnected for call %s", call.id)
                break

            # Handle incoming binary audio chunks
            if message.get("bytes") is not None:
                chunk = message["bytes"]
                audio_chunk_count += 1
                total_bytes += len(chunk)
                if audio_chunk_count % 50 == 0:
                    logger.info("Received audio chunks: %d, total bytes: %d, call: %s", audio_chunk_count, total_bytes, call.id)
                audio_queue.put(chunk)

            # Handle instant client-side Web Speech text frames
            elif message.get("text") is not None:
                try:
                    data = json.loads(message["text"])
                    if data.get("type") == "client_transcript":
                        has_client_transcript = True
                        text = data.get("text", "").strip()
                        is_final = data.get("is_final", False)
                        client_lang = data.get("language") or lang or "en"
                        if text:
                            translation = translate_service.translate_to_english(text, client_lang)
                            translated = translation.get("translated_text") or text
                            det_lang = translation.get("detected_source_language") or client_lang or "en"

                            payload = {
                                "type": "final" if is_final else "interim",
                                "original_text": text,
                                "translated_text": translated,
                                "detected_language": det_lang,
                            }
                            try:
                                await websocket.send_json(payload)
                            except Exception:
                                pass
                            await _broadcast(caller_id or "", payload)
                            await _broadcast(str(call.id), payload)

                            if is_final:
                                seq = next_sequence
                                next_sequence += 1
                                async with AsyncSessionLocal() as db:
                                    db.add(
                                        TranscriptSegment(
                                            call_id=call.id,
                                            sequence=seq,
                                            detected_language=det_lang,
                                            original_text=text,
                                            translated_text=translated,
                                            confidence=0.98,
                                            is_final=True,
                                        )
                                    )
                                    await db.commit()
                except Exception as e:
                    logger.warning("Error processing client text frame: %s", e)

    except WebSocketDisconnect:
        logger.info("WebSocketDisconnect exception for call %s", call.id)
        pass
    finally:
        logger.info("Finalizing call %s - received %d audio chunks, %d total bytes", call.id, audio_chunk_count, total_bytes)
        audio_queue.put(None)
        await responses_task

        # Notify listening operators that call ended
        await _broadcast(caller_id or "", {"type": "call_ended"})
        await _broadcast(str(call.id), {"type": "call_ended"})

        async with AsyncSessionLocal() as db:
            db_call = await db.get(Call, call.id)
            if db_call:
                db_call.status = CallStatus.completed
                db_call.ended_at = datetime.now(timezone.utc)
                await db.commit()
                # Auto-trigger Call Analysis and Complaint Routing
                await _trigger_analysis_and_routing(db_call.id)
