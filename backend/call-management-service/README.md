# call-management-service

Transcribes live (WebRTC) and uploaded call recordings in Indian languages
and translates them to English, using Google Cloud Speech-to-Text +
Translation, with Neon Postgres for storage.

## Prerequisites

1. **Neon Postgres** — already configured in `.env` (`DATABASE_URL`).
2. **A GCP project** with these APIs enabled:
   - Cloud Speech-to-Text API
   - Cloud Translation API
   - Cloud Storage API
3. **A service account** with roles `roles/speech.editor` (or client),
   `roles/cloudtranslate.user`, and `roles/storage.objectAdmin` (scoped to
   the bucket below). Download its JSON key to
   `credentials/gcp-service-account.json` and point
   `GOOGLE_APPLICATION_CREDENTIALS` at it in `.env`.
4. **A GCS bucket** for staging uploaded audio — set `GCS_BUCKET_NAME` in
   `.env`. This is required because uploaded call recordings are almost
   always longer than Google's synchronous recognition limit (~1 min /
   10MB), so the upload flow uses `long_running_recognize` against GCS.

## Setup

```powershell
cd backend/call-management-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Fill in `.env` (already has your Neon `DATABASE_URL`; add the Google Cloud
values). Tables are created automatically on startup — no separate
migration step yet (add Alembic once the schema stabilizes across services).

```powershell
uvicorn app.main:app --reload --port 8001
```

## Endpoints

- `GET /health`
- `POST /calls/upload` — multipart form: `file` (audio), optional
  `language_code` (e.g. `hi-IN`, `ta-IN`), optional `caller_id`. Kicks off
  async transcription + translation; poll `GET /calls/{id}` for results.
- `GET /calls/{id}` — call metadata + full transcript (original +
  translated segments).
- `GET /calls?limit=&offset=` — list calls.
- `WS /ws/calls/live?language_code=hi-IN&caller_id=...` — live transcription.
  Send binary frames of **16kHz mono PCM16** audio; receive JSON messages:
  `{"type": "interim"|"final"|"started"|"error", ...}`.

## On "live transcribing a call on my phone"

There's no OS API that lets a backend reach into a live cellular/VoLTE call.
This service expects **your own VoIP app (WebRTC)** to capture the call
audio client-side and stream it to `/ws/calls/live` — that's the path this
was built for. If you instead want to transcribe real telecom calls, you'd
need to route them through a telephony/CPaaS provider (e.g. Exotel, Twilio)
that can push you a live media stream — different integration, ask if you
want that added later.

## Architecture notes

- `app/services/speech_service.py` — Google Speech-to-Text: batch
  (`long_running_recognize` for uploads) and streaming (live).
- `app/services/translate_service.py` — Google Translate, source-language
  aware.
- `app/services/storage.py` — local staging + GCS upload for uploaded audio.
- `app/workers/transcription.py` — background task run via FastAPI
  `BackgroundTasks` for uploaded calls. Fine for now; move to a real queue
  (Celery/RQ + Redis) once volume grows or you need retries/horizontal
  workers.
- `app/routers/live.py` — bridges the async WebSocket loop to Google's
  blocking gRPC streaming client via a thread + queues.
