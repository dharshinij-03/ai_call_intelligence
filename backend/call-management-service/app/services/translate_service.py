"""Translation service using Gemini API as primary with Google Cloud Translation as fallback.

Converts transcribed Indian-language text to English.
Uses the same Gemini API key already configured in call-analysis-service.
Falls back to returning the original text when all translation methods fail.
"""

import logging
import os
from functools import lru_cache
from typing import Optional
import concurrent.futures

logger = logging.getLogger(__name__)

# Languages that don't need translation
_ENGLISH_CODES = {"en", "en-in", "en-us", "en-gb", "en-au", "voice (live)"}


@lru_cache
def _gemini_client():
    from google import genai
    try:
        from app.config import get_settings
        api_key = get_settings().gemini_api_key or ""
    except Exception:
        import os
        api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key in ("change-me", "YOUR_GEMINI_API_KEY"):
        return None
    return genai.Client(api_key=api_key)


def _gemini_translate(text: str, source_lang: str) -> str:
    """Translate text to English using Gemini API."""
    client = _gemini_client()
    if client is None:
        return text

    prompt = (
        f"Translate the following {source_lang} text to English. "
        f"Return ONLY the translated English text, nothing else.\n\nText: {text}"
    )

    def _call():
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
        )
        return (response.text or text).strip()

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call)
            return future.result(timeout=8.0)
    except Exception as exc:
        logger.warning("Gemini translation failed (%s); returning original", exc)
        return text


def _gcp_translate(text: str, source_lang: str) -> Optional[str]:
    """Try Google Cloud Translation (requires credentials)."""
    try:
        from google.cloud import translate_v2 as translate
        client = translate.Client()
        result = client.translate(text, target_language="en", source_language=source_lang, format_="text")
        return result["translatedText"]
    except Exception as exc:
        logger.debug("GCP translate unavailable: %s", exc)
        return None


def _to_base_lang(speech_lang_code: str) -> str:
    """Extract base language code from BCP-47 (e.g. 'hi-IN' → 'hi')."""
    return speech_lang_code.split("-")[0].lower()


def translate_to_english(text: str, source_language: Optional[str] = None) -> dict:
    """Translate text to English.
    
    Priority:
    1. Skip if already English
    2. Try GCP Cloud Translation (fast, if credentials available)
    3. Try Gemini API (accurate, no extra credentials needed)
    4. Return original text as fallback
    """
    if not text.strip():
        return {"translated_text": "", "detected_source_language": source_language}

    # Normalize language code
    lang_lower = (source_language or "").lower().strip()
    base_lang = _to_base_lang(lang_lower) if lang_lower else "en"

    # Skip translation for English
    if lang_lower in _ENGLISH_CODES or base_lang == "en":
        return {"translated_text": text, "detected_source_language": source_language or "en"}

    # Try GCP first (fast when available)
    gcp_result = _gcp_translate(text, base_lang)
    if gcp_result:
        return {"translated_text": gcp_result, "detected_source_language": source_language}

    # Try Gemini
    language_name = {
        "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "bn": "Bengali",
        "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam",
        "pa": "Punjabi", "ur": "Urdu", "or": "Odia", "as": "Assamese",
    }.get(base_lang, base_lang.upper())

    translated = _gemini_translate(text, language_name)
    return {"translated_text": translated, "detected_source_language": source_language}
