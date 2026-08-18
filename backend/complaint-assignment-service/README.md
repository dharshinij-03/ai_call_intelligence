# complaint-assignment-service

Takes an already-analyzed complaint, forwards it to the correct civic
department, and assigns it to whichever active officer in that department
currently has the lightest open workload. Also generates an AI "how do I fix
this" recommendation for the assigned officer. Implements the department
taxonomy, SLA rules, officer metadata, AI recommendation metadata, and
complaint lifecycle from
`backend/asset/AI-Powered Citizen Call Intelligence Platform.pdf`.

## Setup

```powershell
cd backend/complaint-assignment-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8004
```

`.env` points at the same Neon `DATABASE_URL` as the other services (own
tables, `assignments` + `recommendations`), plus `CALL_ANALYSIS_SERVICE_URL`
(8002) and `USER_MANAGEMENT_SERVICE_URL` (8003) + `SERVICE_API_KEY` — must
match user-management-service's `SERVICE_API_KEY` exactly, since this
service authenticates to it as a machine caller via `X-Service-Key`, not a
user JWT. `GEMINI_API_KEY`/`GEMINI_MODEL` are the same Gemini setup as
call-analysis-service.

## How routing works

`POST /route/{call_id}`:

1. Fetches the complaint's AI analysis from call-analysis-service — its
   `department` and `urgency` fields. 404s if the call hasn't been analyzed
   yet (`call-analysis-service`'s `POST /analyze/{call_id}` must run first).
2. Maps the department name to its official ID (D001-D012) from the PDF's
   department master (`app/departments.py`).
3. Asks user-management-service for active officers in that department
   (`GET /internal/officers`).
4. Picks whichever candidate officer currently has the **fewest open
   assignments** in this service's own `assignments` table — always computed
   live via a `COUNT ... GROUP BY officer_id` query, never a cached counter,
   so it can't drift out of sync.
5. If no officers exist for that department yet, the complaint is stored
   with `status: UNASSIGNED` (not silently dropped) — it becomes assignable
   as soon as an officer is registered for that department and someone
   re-routes it.
6. Computes `sla_due_at` from the department + priority SLA table. The
   source PDF only tables exact hours for D001-D003; every other department
   falls back to the same critical=4h/high=12h/medium=24h/low=72h pattern
   (see `app/departments.py` for exactly which departments have
   document-specified hours vs. the default).

Calling `/route/{call_id}` again on the same call re-routes rather than
duplicating — useful if the department changed on re-analysis, or to retry
once a department that had zero officers gets one.

## Endpoints

- `GET /health`
- `GET /departments` — the 12 official departments (id, code, name).
- `POST /route/{call_id}` — routes + assigns, as above.
- `GET /assignments/{call_id}` — the assignment for one call.
- `GET /assignments?department_id=&officer_id=&status=` — filtered list, e.g.
  an officer's queue (`?officer_id=...`) or a department's open queue
  (`?department_id=D008&status=ASSIGNED`).
- `PATCH /assignments/{call_id}` — update status through the lifecycle
  (`ASSIGNED` → `IN_PROGRESS` → `PENDING_INFORMATION` → `RESOLVED` →
  `CLOSED`, or `REOPENED`).
- `POST /recommendations/{call_id}` — generates an AI fix recommendation for
  the assigned officer via Gemini, from the complaint's
  department/priority/summary. Safe to call again to regenerate (clears any
  prior officer review — it's a new suggestion).
- `GET /recommendations/{call_id}` — the current recommendation.
- `PATCH /recommendations/{call_id}` — officer records whether they accepted
  it and what they actually did (`accepted_by_officer`, `officer_action`).

## AI recommendations ("Officer Copilot")

Matches the source PDF's AI Recommendation Metadata (section 30). Given a
complaint's department, priority, and summary, Gemini returns a structured
`{recommendation_text, recommendation_type, confidence}` — a specific,
actionable next step ("dispatch a repair crew to the reported leak on X
Road"), not generic advice. `recommendation_type` is one of six categories
(field inspection, dispatch repair team, desk resolution, escalate,
coordinate with another department, monitor). The officer's
accept/reject + what they actually did is tracked separately, so it's
possible to later measure how often officers agree with the AI's suggestion.

## Department taxonomy alignment

Aligning to the PDF's 12 official departments meant updating
call-analysis-service's `Department` field (Gemini now classifies into these
exact 12 names) and user-management-service's officer `department` field to
match — all three services now agree on the same department names by value.
Existing test data was migrated to the new names when this changed.
