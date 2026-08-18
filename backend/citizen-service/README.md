# citizen-service

The citizen-facing side of the portal: a citizen calls a real person (an
operator) over a live two-way voice connection, and can see the status of
their own complaints afterward.

## Setup

```powershell
cd backend/citizen-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8006
```

`.env` needs the same Neon `DATABASE_URL` as the other services (own table,
`call_sessions`), and `JWT_SECRET_KEY`/`JWT_ALGORITHM` matching
**user-management-service exactly** — this service verifies JWTs locally
(signature + expiry) instead of calling back into user-management-service on
every request. Log in via user-management-service (`POST :8003/auth/login`);
that token works here.

## Demo pages

- `http://localhost:8006/demo/citizen.html` — log in as a citizen, request a
  call, see it connect once an operator answers, view "My Complaints".
- `http://localhost:8006/demo/operator.html` — log in as an operator, see
  the live queue, accept a waiting call.

Open both in separate browser tabs (or two different browsers/machines) to
test a real call. Default test accounts are pre-filled in the forms.

## How the call actually works

**This service never touches audio.** The citizen and operator browsers
establish a direct WebRTC peer connection between themselves; this service
only does matchmaking and relays the SDP offer/answer + ICE candidates
neither browser can exchange on its own:

1. Citizen: `POST /calls/request` → creates a `WAITING` call session,
   broadcast to every operator watching `WS /ws/operator-queue`.
2. Operator: `POST /calls/{id}/accept` → session becomes `CONNECTED`,
   removed from every other operator's queue view.
3. Both sides open `WS /ws/signal/{call_session_id}` — once both are
   connected, each gets a `peer_joined` event. The citizen (as the call
   initiator) creates the WebRTC offer; the operator answers; both relay
   ICE candidates as they're gathered. From here the browsers are talking
   directly to each other — audio no longer flows through this service.
4. `POST /calls/{id}/end` (either party) relays a `hangup` message to the
   other side and closes out the session.

**Transcription still happens.** While the citizen is on the call, their
browser *also* opens a second, independent connection — straight to
call-management-service's `/ws/calls/live`, exactly like that service's own
demo page — streaming the same mic audio for live transcription. It passes
this call session's id as `caller_id`, which is the only thing that links a
`call_sessions` row (owned here) to a `calls` row (owned by
call-management-service): `GET /complaints/mine` joins on
`calls.caller_id = call_sessions.id::text`. No callback or extra API needed
to wire the two together.

## Endpoints

- `GET /health`
- `POST /calls/request` — citizen only. Joins the queue.
- `GET /calls/queue` — operator/admin only. REST fallback/snapshot of
  `WAITING` sessions (the WS pushes new ones live).
- `POST /calls/{id}/accept` — operator only. 409 if already claimed.
- `POST /calls/{id}/end` — either participant (or admin).
- `WS /ws/operator-queue?token=` — operator/admin. Live feed of
  `call_waiting` / `call_claimed` events.
- `WS /ws/signal/{call_session_id}?token=` — the two participants only.
  Pure relay of whatever JSON messages the other side needs
  (`offer`/`answer`/`ice-candidate`/`hangup`); this service never
  interprets the SDP.
- `GET /complaints/mine` — citizen only. Their own complaints, joined
  across call-management-service + call-analysis-service +
  complaint-assignment-service, most recent first.

## Known limitations (by design, for a hackathon)

- **In-process state.** The operator queue and signaling relay live in
  plain Python dicts/sets, not Redis — fine for one process, would need
  reworking for a multi-worker or multi-instance deployment.
- **STUN only, no TURN.** Uses Google's public STUN server for ICE. Works
  for same-network/localhost testing and most direct connections; a
  restrictive NAT/firewall on either side can still block the P2P
  connection without a TURN relay, which no free option reliably provides.
- **First auth enforcement in this project.** Every other service either
  has no auth or only checks a shared secret between services. This is the
  first one that verifies a real user's JWT — a good template for adding
  the same to call-management-service, call-analysis-service, and
  complaint-assignment-service later.
