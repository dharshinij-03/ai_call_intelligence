# call-analysis-service

Reads a call's transcript from `call-management-service`, sends it to Gemini
for structured extraction, and stores the result: sentiment, urgency, a
two-line summary, which civic department should handle it, mentioned
location, and keyword tags. Also cross-checks new complaints against
recent ones nearby to catch duplicate reports of the same incident.

## Setup

1. Get a free Gemini API key at https://aistudio.google.com/apikey (no credit
   card needed for the free tier) and put it in `.env` as `GEMINI_API_KEY`.
2. `.env` already points at the same Neon `DATABASE_URL` as
   call-management-service (separate table, no cross-service foreign key —
   each service owns its own schema) and assumes call-management-service is
   running at `http://localhost:8001`.

```powershell
cd backend/call-analysis-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002
```

## Endpoints

- `GET /health`
- `POST /analyze/{call_id}` — fetches the call's transcript from
  call-management-service, runs it through Gemini, stores + returns the
  analysis. Safe to call again on the same call — it overwrites the prior
  analysis rather than duplicating it.
- `GET /analysis/{call_id}` — returns the stored analysis.
- `GET /duplicates/{call_id}` — every complaint linked to the same
  underlying incident as this call (including the original), so ops can see
  "N reports, one incident" instead of N separate tickets.

## Duplicate detection

When a call is analyzed, it's cross-checked against the database for an
existing complaint that's likely the same real-world incident, so two people
calling about the same fire don't become two separate tickets:

1. **SQL pre-filter** — same `department`, created within the last 48h, and
   (via Haversine distance on stored GPS coordinates) within 1km. Cheap,
   indexed, and keeps the candidate set small.
2. **Gemini confirms** — for each nearby candidate, asks whether the two
   summaries genuinely describe the same incident, not just two unrelated
   problems that happen to share a category and neighborhood (e.g. two
   different potholes reported the same day on the same street are *not*
   duplicates).

Requires GPS coordinates on the new complaint (see `call-management-service`'s
location capture) — without them, duplicate detection is skipped rather than
guessing off department + time alone, which is too weak a signal on its own.

A detected duplicate always resolves to the *root* of its incident (never
chains through another duplicate), so `GET /duplicates/{call_id}` on any
linked complaint returns the same full group.

## Why Gemini here, not Claude

This service's owner wanted a genuinely free option for a hackathon, and this
project already has a Google Cloud account set up for Speech-to-Text and
Translate — Gemini's free tier reuses that ecosystem and needs no billing
setup at all, unlike most LLM APIs.
