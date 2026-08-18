import logging
from pathlib import Path
from uuid import UUID

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import Call, CallStatus, TranscriptSegment
from app.services import whisper_speech_service as speech_service, storage, translate_service

logger = logging.getLogger(__name__)


async def process_uploaded_call(call_id: UUID, local_path_str: str) -> None:
    settings = get_settings()
    local_path = Path(local_path_str)

    async with AsyncSessionLocal() as db:
        call = await db.get(Call, call_id)
        if call is None:
            return

        try:
            call.status = CallStatus.processing
            await db.commit()

            language_code = call.primary_language or settings.default_language_code
            results = speech_service.transcribe_file(str(local_path), language_code)

            for i, r in enumerate(results):
                translation = translate_service.translate_to_english(r["text"], r["language_code"])
                db.add(
                    TranscriptSegment(
                        call_id=call.id,
                        sequence=i,
                        detected_language=r["language_code"],
                        original_text=r["text"],
                        translated_text=translation["translated_text"],
                        confidence=r.get("confidence"),
                        is_final=True,
                    )
                )

            call.status = CallStatus.completed
            await db.commit()
        except Exception as exc:
            logger.exception("Failed to process call %s", call_id)
            call.status = CallStatus.failed
            call.error_message = str(exc)
            await db.commit()
