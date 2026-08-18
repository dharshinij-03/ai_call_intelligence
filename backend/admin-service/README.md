# admin-service

Read-only reporting layer for the ADMINISTRATOR role from the source PDF
(section 37): all departments, officers under each, every complaint and who
it's assigned to, complaint status, heat maps, and complaint trends.

This service owns no data and no tables. It reads tables that
call-management-service, call-analysis-service, complaint-assignment-service,
and user-management-service each already own and migrate — a JOIN-based
reporting layer over the one shared Neon Postgres instance every service in
this project already uses, rather than fanning out N+1 HTTP calls across
four services for every dashboard view.

## Setup

```powershell
cd backend/admin-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8005
```

`.env` just needs the same Neon `DATABASE_URL` as every other service.

## Endpoints

- `GET /health`
- `GET /departments` — all 12 departments with live officer/complaint/SLA-breach
  counts (Department Master + Department Performance Metadata, PDF sections
  2, 28).
- `GET /departments/{department_id}/officers` — officers under one
  department with live workload, resolved count, average resolution time,
  and SLA compliance % (Officer Metadata, section 27).
- `GET /complaints?department_id=&status=&officer_id=&is_duplicate=&limit=&offset=` —
  every complaint, joined across all four services: call metadata + GPS
  (call-management-service), AI classification (call-analysis-service),
  department/officer routing + SLA (complaint-assignment-service). This is
  "what officer is assigned what complaint, and its status" in one call.
- `GET /complaints/{call_id}` — same, for one complaint, plus its AI
  recommendation and the officer's logged action.
- `GET /heatmap` — complaints grouped into a ~100m grid (3-decimal lat/lng
  rounding) with count, critical count, and dominant department per cell —
  direct input for a map heatmap layer (Heat Map Metadata, section 32).
- `GET /trends?days=30&by_department=false` — daily complaint volume,
  optionally broken down per department (Predictive Analytics Metadata,
  section 31 — historical counts only, no ML forecasting).
- `GET /overview` — single-call dashboard summary: city-wide totals
  (total/open/resolved/critical/duplicate/SLA-breaches) plus the same
  per-department breakdown as `GET /departments`.

## A real bug worth knowing about (native Postgres enums + raw SQL)

`assignments.status` and `recommendations.recommendation_type` are native
Postgres ENUM types created by SQLAlchemy from Python `str, enum.Enum`
classes. SQLAlchemy's ORM layer stores the enum **member name**
(`"assigned"`, `"in_progress"`) as the Postgres label — not the `.value`
string (`"ASSIGNED"`) that every service's JSON API actually returns. That
translation happens transparently inside the ORM, but this service bypasses
the ORM and queries these tables directly with raw SQL, so it has to do the
translation itself. Every query here therefore casts and uppercases:
`upper(status::text)` — which works because every enum in this project was
deliberately defined so `upper(name) == value` (e.g. `in_progress` /
`"IN_PROGRESS"`). If a future enum breaks that convention, this pattern
breaks with it.

## No auth yet

Like the other services, this doesn't verify a JWT / admin role — that's a
known gap shared across the whole project (see user-management-service's
README), not something specific to this service. Add JWT verification here
before this is exposed beyond local development.
