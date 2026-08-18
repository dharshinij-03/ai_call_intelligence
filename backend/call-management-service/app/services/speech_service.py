"""Wraps Google Cloud Speech-to-Text for both batch (uploaded) and
streaming (live) transcription of Indian-language audio."""

import queue
from typing import Iterator, List, Optional

from google.cloud import speech


def build_alternate_languages(
    primary_language: str, configured: Optional[List[str]] = None, limit: int = 3
) -> List[str]:
    """Google only considers a language per *utterance* (i.e. per pause-bounded
    phrase), not word-by-word — but Indian speech constantly code-switches into
    English, so English should always be offered as an alternate regardless of
    which regional language is selected. Google caps alternates at 3 total."""
    candidates = ["en-IN", *(configured or [])]
    result: List[str] = []
    for code in candidates:
        if code == primary_language or code in result:
            continue
        result.append(code)
        if len(result) >= limit:
            break
    return result


def _build_recognition_config(
    language_code: str, alternative_language_codes: Optional[List[str]] = None
) -> speech.RecognitionConfig:
    return speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code=language_code,
        alternative_language_codes=alternative_language_codes or [],
        enable_automatic_punctuation=True,
    )


def transcribe_gcs_audio(
    gcs_uri: str, language_code: str, alternative_language_codes: Optional[List[str]] = None
) -> List[dict]:
    """Batch-transcribes a file already staged in GCS. Used for uploaded calls,
    since Google's synchronous API is capped at ~1 minute / 10MB."""
    client = speech.SpeechClient()
    config = _build_recognition_config(language_code, alternative_language_codes)
    audio = speech.RecognitionAudio(uri=gcs_uri)

    operation = client.long_running_recognize(config=config, audio=audio)
    response = operation.result(timeout=1800)

    results = []
    for result in response.results:
        if not result.alternatives:
            continue
        alt = result.alternatives[0]
        results.append(
            {
                "text": alt.transcript,
                "confidence": alt.confidence,
                "language_code": result.language_code or language_code,
            }
        )
    return results


def _streaming_requests(audio_queue: "queue.Queue[Optional[bytes]]") -> Iterator[speech.StreamingRecognizeRequest]:
    while True:
        chunk = audio_queue.get()
        if chunk is None:
            return
        yield speech.StreamingRecognizeRequest(audio_content=chunk)


def streaming_recognize(
    audio_queue: "queue.Queue[Optional[bytes]]",
    language_code: str,
    alternative_language_codes: Optional[List[str]] = None,
):
    """Blocking generator over Google's gRPC streaming API. Callers must run this
    in a worker thread and feed `audio_queue` with 16kHz mono LINEAR16 chunks,
    ending with a `None` sentinel to close the stream."""
    client = speech.SpeechClient()
    config = _build_recognition_config(language_code, alternative_language_codes)
    streaming_config = speech.StreamingRecognitionConfig(config=config, interim_results=True)

    requests = _streaming_requests(audio_queue)
    responses = client.streaming_recognize(config=streaming_config, requests=requests)
    for response in responses:
        yield response
