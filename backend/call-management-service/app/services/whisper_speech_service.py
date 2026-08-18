"""Live speech transcription via OpenAI Whisper (local).

Uses fixed non-overlapping ~4s windows (with a short pre-roll) instead of
aggressive VAD. Short energy-gated clips were producing empty results or
one-word hallucinations like "Nice." while real speech was dropped.

Yields Google-Speech-shaped responses for app/routers/live.py.
"""

from __future__ import annotations

import logging
import queue
from types import SimpleNamespace
from typing import Iterator, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

# tiny model is fast and robust on CPU for streaming without KV cache dimension mismatches
WHISPER_MODEL_NAME = "tiny"

SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2
# 3s windows balance low latency and complete phrase acoustic context for Whisper
WINDOW_SEC = 3.0
WINDOW_BYTES = int(SAMPLE_RATE * BYTES_PER_SAMPLE * WINDOW_SEC)
# Skip only near-total silence
MIN_RMS = 0.00005
MIN_CHARS = 1

_model = None

_WHISPER_LANGS = {
    "en", "hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa", "ur", "or", "as",
}

# Drop only well-known empty hallucinations — never drop real short words
_BLOCKLIST = {
    "thanks for watching.",
    "thank you for watching.",
    "subscribe",
    "thanks for watching",
    "you",
    ".",
    "...",
    "[music]",
    "[applause]",
    "(music)",
}


def build_alternate_languages(
    primary_language: str, configured: Optional[List[str]] = None, limit: int = 3
) -> List[str]:
    candidates = ["en-IN", *(configured or [])]
    result: List[str] = []
    for code in candidates:
        if code == primary_language or code in result:
            continue
        result.append(code)
        if len(result) >= limit:
            break
    return result


def transcribe_file(local_path: str, language_code: Optional[str] = None) -> List[dict]:
    """Batch transcribe a local audio file directly using local OpenAI Whisper."""
    model = _get_model()
    result = model.transcribe(
        str(local_path),
        language=None,
        task="transcribe",
        fp16=False,
    )
    text = (result.get("text") or "").strip()
    detected_lang = result.get("language") or language_code or "en"
    if not text:
        return []
    return [
        {
            "text": text,
            "confidence": 0.95,
            "language_code": detected_lang,
        }
    ]


def _get_model():
    global _model
    if _model is None:
        import whisper

        logger.info("Loading Whisper model '%s'…", WHISPER_MODEL_NAME)
        _model = whisper.load_model(WHISPER_MODEL_NAME)
        logger.info("Whisper model ready")
    return _model


def _whisper_language(bcp47: Optional[str]) -> Optional[str]:
    if not bcp47:
        return None
    primary = bcp47.split("-")[0].lower()
    return primary if primary in _WHISPER_LANGS else None


def _pcm16_to_float32(pcm: bytes) -> np.ndarray:
    if not pcm:
        return np.zeros(0, dtype=np.float32)
    if len(pcm) % 2 != 0:
        pcm = pcm[:len(pcm) - (len(pcm) % 2)]
    return np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0


def _rms(audio: np.ndarray) -> float:
    if audio.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(audio))))


def _make_response(transcript: str, language_code: str, is_final: bool) -> SimpleNamespace:
    return SimpleNamespace(
        error=SimpleNamespace(code=0, message=""),
        speech_event_type=None,
        results=[
            SimpleNamespace(
                alternatives=[
                    SimpleNamespace(
                        transcript=transcript,
                        confidence=0.9 if is_final else None,
                    )
                ],
                is_final=is_final,
                language_code=language_code,
            )
        ],
    )


def _format_lang(detected: str, language_code: str) -> str:
    if isinstance(detected, str) and len(detected) == 2:
        if language_code and "-" in language_code:
            return f"{detected}-{language_code.split('-', 1)[1]}"
        return f"{detected}-IN"
    return detected if isinstance(detected, str) else str(language_code or "und")


def _transcribe_window(pcm: bytes, language_code: str) -> Optional[SimpleNamespace]:
    audio = _pcm16_to_float32(pcm)
    energy = _rms(audio)
    logger.info("Transcribing window: PCM bytes=%d, samples=%d, energy=%.6f", len(pcm), len(audio), energy)
    
    if energy < MIN_RMS:
        logger.info("Skipping silent window (energy %.6f < threshold %.6f)", energy, MIN_RMS)
        return None

    # Pad short clips to ≥1s
    if audio.size < SAMPLE_RATE:
        audio = np.pad(audio, (0, SAMPLE_RATE - audio.size))

    # Normalize audio volume so quiet mics have crisp signal levels
    peak = float(np.max(np.abs(audio)))
    if peak > 0.001 and peak < 0.5:
        audio = audio * (0.8 / peak)

    # Use explicit language hint if available (dramatically improves accuracy over auto-detect)
    whisper_lang = _whisper_language(language_code)

    model = _get_model()
    try:
        result = model.transcribe(
            audio,
            language=whisper_lang,     # explicit language hint when available
            task="transcribe",
            fp16=False,
            temperature=0.0,           # deterministic greedy decoding
            no_speech_threshold=0.5,   # filter silence
            condition_on_previous_text=False,
            initial_prompt="Municipal grievance complaint regarding road, water supply, electricity, garbage, traffic, police, public health.",
        )
    except Exception as e:
        logger.exception("Whisper transcribe failed: %s", str(e))
        return None

    text = (result.get("text") or "").strip()
    logger.info("Whisper raw: %r (lang=%s, energy=%.6f)", text, result.get("language"), energy)
    
    if not text:
        return None

    if text.lower().strip(".! ") in _BLOCKLIST:
        logger.info("Skipping blocklisted hallucination: %r", text)
        return None

    detected = result.get("language") or language_code or "en"
    logger.info("✅ Transcript: %r (lang=%s)", text, detected)
    return _make_response(text, _format_lang(str(detected), language_code or ""), is_final=True)


def streaming_recognize(
    audio_queue: "queue.Queue[Optional[bytes]]",
    language_code: str,
    alternative_language_codes: Optional[List[str]] = None,
) -> Iterator[SimpleNamespace]:
    """Decode every WINDOW_SEC of incoming PCM (non-overlapping)."""
    try:
        _get_model()
    except Exception as exc:
        logger.exception("Failed to load Whisper")
        raise RuntimeError(f"Whisper model failed to load: {exc}") from exc

    buffer = bytearray()
    chunk_count = 0
    total_bytes = 0
    logger.info(
        "Live STT started language=%s window=%.1fs",
        language_code,
        WINDOW_SEC,
    )

    while True:
        try:
            chunk = audio_queue.get(timeout=0.4)
        except queue.Empty:
            # User paused speaking! If buffer contains at least 0.5s of audio, transcribe it now.
            if len(buffer) >= int(SAMPLE_RATE * BYTES_PER_SAMPLE * 0.5):
                logger.info("Pause timeout: transcribing buffered audio (%d bytes)", len(buffer))
                resp = _transcribe_window(bytes(buffer), language_code)
                buffer.clear()
                if resp is not None:
                    text = resp.results[0].alternatives[0].transcript
                    lang = resp.results[0].language_code
                    logger.info("Pause transcript OK: %s (lang: %s)", text, lang)
                    yield _make_response(text, lang, is_final=False)
                    yield resp
            continue

        if chunk is None:
            logger.info("Audio stream ended. Total chunks: %d, total bytes: %d, buffer size: %d", chunk_count, total_bytes, len(buffer))
            if len(buffer) >= SAMPLE_RATE * BYTES_PER_SAMPLE // 2:
                logger.info("Processing final buffer chunk of %d bytes", len(buffer))
                resp = _transcribe_window(bytes(buffer), language_code)
                if resp is not None:
                    text = resp.results[0].alternatives[0].transcript
                    lang = resp.results[0].language_code
                    logger.info("Final buffer yielding interim: %s", text)
                    yield _make_response(text, lang, is_final=False)
                    yield resp
                else:
                    logger.info("Final buffer transcription returned None (probably silence)")
            break

        if chunk:
            chunk_count += 1
            total_bytes += len(chunk)
            if chunk_count % 50 == 0:
                logger.info("Streaming chunks received: %d, buffer size: %d bytes, total: %d bytes", chunk_count, len(buffer), total_bytes)
            buffer.extend(chunk)

        while len(buffer) >= WINDOW_BYTES:
            window = bytes(buffer[:WINDOW_BYTES])
            del buffer[:WINDOW_BYTES]
            logger.debug("Processing window of %d bytes from buffer, remaining: %d", len(window), len(buffer))
            resp = _transcribe_window(window, language_code)
            if resp is None:
                logger.debug("Transcription returned None (silence), skipping")
                continue
            text = resp.results[0].alternatives[0].transcript
            lang = resp.results[0].language_code
            logger.info("Window transcription: %s (lang: %s)", text, lang)
            yield _make_response(text, lang, is_final=False)
            yield resp
