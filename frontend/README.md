# frontend

React + Vite + TypeScript SPA covering all four roles across all six backend
services: citizen (call an operator, view complaint status), operator (live
call queue), officer (assigned complaints + AI recommendations), admin
(overview dashboard, departments/officers, all complaints, heat map, trends).

## Setup

```powershell
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173` (Vite's dev server binds to IPv6 loopback
only in this environment — use `localhost`, not `127.0.0.1`). `.env` already
points at all six backend services on their default ports; see
`.env.example` if you need to change them.

**All six backend services must be running** for the app to be useful:
call-management-service (8001), call-analysis-service (8002),
user-management-service (8003), complaint-assignment-service (8004),
admin-service (8005), citizen-service (8006).

## Stack

- **React Router** — role-based routes under one shell (`/citizen/*`,
  `/operator/*`, `/officer/*`, `/admin/*`), gated by `ProtectedRoute`.
- **TanStack Query** — data fetching/caching/polling for every REST call.
- **Tailwind CSS v4** — via `@tailwindcss/vite`, no separate PostCSS config.
- **Leaflet** (`react-leaflet`) — the admin heat map, OpenStreetMap tiles,
  no API key, consistent with the free-tooling choices made throughout the
  backend (Nominatim reverse geocoding, Gemini free tier).
- **Recharts** — trend charts.
- Auth: JWT from user-management-service, decoded client-side
  (`jwt-decode`) for role/name display; the token itself is sent as
  `Authorization: Bearer` to whichever service needs it.

## Structure

```
src/
  lib/
    config.ts        service URLs (from .env)
    types.ts          TypeScript types mirroring every backend Pydantic schema
    auth.tsx           AuthContext: login/register/logout, JWT decode
    format.ts          date formatting, status/urgency badge color mapping
    audio.ts            PCM16 downsampling shared by the citizen call page
    api/                one typed client file per backend service
  components/         Layout, ProtectedRoute, Badge, Spinner/Error/Empty, StatTile
  pages/
    auth/               Login, Register
    citizen/            Call (WebRTC + live transcript), My Complaints
    operator/           Queue + WebRTC answer side
    officer/            Assigned complaints, complaint detail + AI recommendation
    admin/              Overview, Departments, Department detail, Complaints,
                         Complaint detail, Heat Map, Trends
```

## The live call (citizen ↔ operator)

Ported directly from `citizen-service/demo/{citizen,operator}.html` into
React — same WebRTC signaling protocol, same transcription-tee trick (the
citizen's browser opens a second WebSocket straight to
call-management-service, passing the call session id as `caller_id`, which
is how `GET /complaints/mine` later correlates the two). See
`citizen-service/README.md` for the full mechanism.

## Data visualization

Built following the `dataviz` skill: the heat map uses a single validated
sequential blue ramp (density → darker/larger circles), the trend charts use
a single-series line (no legend needed) and a single-color bar chart (count
per department, identity already carried by the axis labels — no need for a
12-way categorical palette). The brand blue used for buttons/links throughout
the app is the same validated blue (`palette.md`'s categorical slot 1 /
sequential hue), so the UI and the charts read as one system. Status/urgency
badges use Tailwind's semantic palette rather than the strict 4-role status
palette, since the app has far more distinct states (7 assignment statuses,
4 urgency levels, 4 call-session statuses) than that palette's fixed
good/warning/serious/critical roles cover.

## Known gaps (by design, for a hackathon)

- No auth enforcement on call-management-service, call-analysis-service,
  complaint-assignment-service, or admin-service — only citizen-service
  checks JWTs. The frontend still gates routes by role client-side, but a
  user who calls those services' APIs directly bypasses that. See
  citizen-service's README for the pattern to extend to the others.
- No pagination UI on the admin complaints list beyond the backend's
  `limit`/`offset` (fetches up to 100 at once).
- WebRTC uses STUN only, no TURN — see citizen-service's README for what
  that means for restrictive networks.
