import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib import error, parse, request

import psycopg2


ROOT = Path(__file__).resolve().parents[1]
ADMIN_ENV = ROOT / "backend" / "admin-service" / ".env"
USER_ENV = ROOT / "backend" / "user-management-service" / ".env"

USER_MGMT_URL = "http://127.0.0.1:8003"
CITIZEN_URL = "http://127.0.0.1:8006"

SEED_PASSWORD = "Seed@12345"
SEED_USERS = [
    {
        "email": "seed.admin@complaints.com",
        "full_name": "Seed Admin",
        "phone_number": "9000000001",
        "role": "admin",
        "department": None,
    },
    {
        "email": "seed.operator@complaints.com",
        "full_name": "Seed Operator",
        "phone_number": "9000000002",
        "role": "operator",
        "department": None,
    },
    {
        "email": "seed.officer@complaints.com",
        "full_name": "Seed Officer",
        "phone_number": "9000000003",
        "role": "officer",
        "department": "Roads & Public Works",
    },
    {
        "email": "seed.citizen@complaints.com",
        "full_name": "Seed Citizen",
        "phone_number": "9000000004",
        "role": "citizen",
        "department": None,
    },
]

DEPT_ID_BY_NAME = {
    "Water Supply & Sewerage": "D001",
    "Sanitation & Solid Waste": "D002",
    "Roads & Public Works": "D003",
    "Electricity & Street Lighting": "D004",
    "Public Transport": "D005",
    "Traffic Management": "D006",
    "Public Health": "D007",
    "Emergency & Disaster Management": "D008",
    "Police & Public Safety": "D009",
    "Municipal Services": "D010",
    "Environment": "D011",
    "Revenue & Civic Administration": "D012",
}


def read_env_value(path: Path, key: str) -> str:
    with path.open("r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1]
    raise RuntimeError(f"{key} not found in {path}")


def http_json(method: str, url: str, payload: dict | None = None, token: str | None = None) -> tuple[int, Any]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"} if payload is not None else {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(url, data=data, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else None
    except error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        parsed = json.loads(body) if body else {"detail": str(e)}
        return e.code, parsed


def http_form_post(url: str, form_data: dict[str, str]) -> tuple[int, Any]:
    data = parse.urlencode(form_data).encode("utf-8")
    req = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else None
    except error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        parsed = json.loads(body) if body else {"detail": str(e)}
        return e.code, parsed


def ensure_users_and_login(admin_bootstrap_key: str) -> dict[str, dict]:
    print("-> Ensuring seed users exist and can log in...")
    for user in SEED_USERS:
        payload = {
            "email": user["email"],
            "password": SEED_PASSWORD,
            "full_name": user["full_name"],
            "phone_number": user["phone_number"],
            "role": user["role"],
            "department": user["department"],
        }
        if user["role"] != "citizen":
            payload["admin_bootstrap_key"] = admin_bootstrap_key
        status, _ = http_json("POST", f"{USER_MGMT_URL}/auth/register", payload)
        if status not in (201, 409):
            raise RuntimeError(f"Failed to register {user['email']}: status={status}")

    sessions: dict[str, dict] = {}
    for user in SEED_USERS:
        status, body = http_form_post(
            f"{USER_MGMT_URL}/auth/login",
            {"username": user["email"], "password": SEED_PASSWORD},
        )
        if status != 200:
            raise RuntimeError(f"Failed to login {user['email']}: status={status} body={body}")
        sessions[user["email"]] = body
    return sessions


def cleanup_old_seed_rows(cur) -> None:
    print("-> Cleaning previous seeded complaints...")
    cur.execute(
        """
        WITH seeded_sessions AS (
            SELECT id
            FROM call_sessions
            WHERE citizen_name = 'Seed Citizen'
        ),
        seeded_calls AS (
            SELECT id
            FROM calls
            WHERE caller_id IN (SELECT id::text FROM seeded_sessions)
        )
        DELETE FROM citizen_feedback
        WHERE call_id IN (SELECT id FROM seeded_calls)
        """
    )
    cur.execute(
        """
        WITH seeded_sessions AS (
            SELECT id
            FROM call_sessions
            WHERE citizen_name = 'Seed Citizen'
        ),
        seeded_calls AS (
            SELECT id
            FROM calls
            WHERE caller_id IN (SELECT id::text FROM seeded_sessions)
        )
        DELETE FROM recommendations
        WHERE call_id IN (SELECT id FROM seeded_calls)
        """
    )
    cur.execute(
        """
        WITH seeded_sessions AS (
            SELECT id
            FROM call_sessions
            WHERE citizen_name = 'Seed Citizen'
        ),
        seeded_calls AS (
            SELECT id
            FROM calls
            WHERE caller_id IN (SELECT id::text FROM seeded_sessions)
        )
        DELETE FROM assignments
        WHERE call_id IN (SELECT id FROM seeded_calls)
        """
    )
    cur.execute(
        """
        WITH seeded_sessions AS (
            SELECT id
            FROM call_sessions
            WHERE citizen_name = 'Seed Citizen'
        ),
        seeded_calls AS (
            SELECT id
            FROM calls
            WHERE caller_id IN (SELECT id::text FROM seeded_sessions)
        )
        DELETE FROM call_analysis
        WHERE call_id IN (SELECT id FROM seeded_calls)
        """
    )
    cur.execute(
        """
        WITH seeded_sessions AS (
            SELECT id
            FROM call_sessions
            WHERE citizen_name = 'Seed Citizen'
        ),
        seeded_calls AS (
            SELECT id
            FROM calls
            WHERE caller_id IN (SELECT id::text FROM seeded_sessions)
        )
        DELETE FROM transcript_segments
        WHERE call_id IN (SELECT id FROM seeded_calls)
        """
    )
    cur.execute(
        """
        DELETE FROM calls
        WHERE caller_id IN (
            SELECT id::text FROM call_sessions WHERE citizen_name = 'Seed Citizen'
        )
        """
    )
    cur.execute("DELETE FROM call_sessions WHERE citizen_name = 'Seed Citizen'")


def seed_complaints(cur, citizen_id: str, officer_id: str, officer_name: str) -> list[str]:
    print("-> Seeding end-to-end complaints...")
    now = datetime.now(timezone.utc)
    scenarios = [
        {
            "department": "Roads & Public Works",
            "urgency": "critical",
            "sentiment": "angry",
            "summary": "Large pothole near MG Road is causing accidents and vehicle damage.",
            "location": "MG Road, Bengaluru",
            "lat": 12.9754,
            "lng": 77.6062,
            "assignment_status": "resolved",
            "is_duplicate": False,
        },
        {
            "department": "Roads & Public Works",
            "urgency": "high",
            "sentiment": "negative",
            "summary": "Road surface broken at MG Road signal; commuters report daily traffic jams.",
            "location": "MG Road Signal, Bengaluru",
            "lat": 12.9755,
            "lng": 77.6061,
            "assignment_status": "assigned",
            "is_duplicate": True,
        },
        {
            "department": "Water Supply & Sewerage",
            "urgency": "medium",
            "sentiment": "distressed",
            "summary": "No drinking water supply in ward for two days and tanker not arriving.",
            "location": "Indiranagar 12th Main, Bengaluru",
            "lat": 12.9719,
            "lng": 77.6412,
            "assignment_status": "in_progress",
            "is_duplicate": False,
        },
        {
            "department": "Public Health",
            "urgency": "high",
            "sentiment": "negative",
            "summary": "Garbage accumulation near market causing foul smell and mosquito breeding.",
            "location": "KR Market, Bengaluru",
            "lat": 12.9591,
            "lng": 77.5738,
            "assignment_status": "closed",
            "is_duplicate": False,
        },
    ]

    inserted_call_ids: list[str] = []
    first_roads_call_id: str | None = None
    for i, s in enumerate(scenarios):
        call_session_id = str(uuid.uuid4())
        call_id = str(uuid.uuid4())
        analysis_id = str(uuid.uuid4())
        assignment_id = str(uuid.uuid4())
        segment_id = str(uuid.uuid4())
        rec_id = str(uuid.uuid4())
        requested_at = now - timedelta(hours=18 - i * 2)
        started_at = requested_at + timedelta(minutes=2)
        ended_at = started_at + timedelta(minutes=6)
        sla_due_at = requested_at + timedelta(hours=24)

        cur.execute(
            """
            INSERT INTO call_sessions
              (id, citizen_id, citizen_name, status, requested_at, connected_at, ended_at, latitude, longitude, location_accuracy)
            VALUES
              (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                call_session_id,
                citizen_id,
                "Seed Citizen",
                "ended",
                requested_at,
                started_at,
                ended_at,
                s["lat"],
                s["lng"],
                18.0,
            ),
        )

        cur.execute(
            """
            INSERT INTO calls
              (id, source, status, caller_id, primary_language, latitude, longitude, address, started_at, ended_at, created_at)
            VALUES
              (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                call_id,
                "live",
                "completed",
                call_session_id,
                "en-IN",
                s["lat"],
                s["lng"],
                s["location"],
                started_at,
                ended_at,
                requested_at,
            ),
        )

        cur.execute(
            """
            INSERT INTO transcript_segments
              (id, call_id, sequence, detected_language, original_text, translated_text, confidence, is_final, created_at)
            VALUES
              (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                segment_id,
                call_id,
                0,
                "en-IN",
                s["summary"],
                s["summary"],
                0.98,
                True,
                started_at,
            ),
        )

        duplicate_of = first_roads_call_id if s["is_duplicate"] else None
        if s["department"] == "Roads & Public Works" and first_roads_call_id is None:
            first_roads_call_id = call_id

        cur.execute(
            """
            INSERT INTO call_analysis
              (id, call_id, summary, sentiment, urgency, department, location, tags, reasoning, latitude, longitude,
               is_duplicate, duplicate_of_call_id, transcript_snapshot, created_at)
            VALUES
              (%s, %s, %s, %s, %s, %s, %s, ARRAY[]::text[], %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                analysis_id,
                call_id,
                s["summary"],
                s["sentiment"],
                s["urgency"],
                s["department"],
                s["location"],
                "Seeded end-to-end scenario",
                s["lat"],
                s["lng"],
                bool(s["is_duplicate"]),
                duplicate_of,
                s["summary"],
                requested_at,
            ),
        )

        cur.execute(
            """
            INSERT INTO assignments
              (id, call_id, department_id, department_name, priority, officer_id, officer_name, status,
               sla_due_at, assigned_at, created_at)
            VALUES
              (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                assignment_id,
                call_id,
                DEPT_ID_BY_NAME[s["department"]],
                s["department"],
                s["urgency"],
                officer_id,
                officer_name,
                s["assignment_status"],
                sla_due_at,
                requested_at + timedelta(minutes=20),
                requested_at,
            ),
        )

        cur.execute(
            """
            INSERT INTO recommendations
              (id, call_id, recommendation_text, recommendation_type, confidence, accepted_by_officer, officer_action, generated_at, created_at)
            VALUES
              (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                rec_id,
                call_id,
                "Dispatch field team and confirm closure with citizen.",
                "dispatch_repair_team",
                0.87,
                None,
                None,
                requested_at + timedelta(minutes=10),
                requested_at + timedelta(minutes=10),
            ),
        )

        inserted_call_ids.append(call_id)

    return inserted_call_ids


def submit_feedback(citizen_token: str, call_id: str, rating: int, comments: str) -> None:
    status, body = http_json(
        "POST",
        f"{CITIZEN_URL}/complaints/{call_id}/feedback",
        {"rating": rating, "comments": comments},
        token=citizen_token,
    )
    if status != 200:
        raise RuntimeError(f"Submitting feedback failed: status={status} body={body}")


def main() -> None:
    database_url = read_env_value(ADMIN_ENV, "DATABASE_URL")
    admin_bootstrap_key = read_env_value(USER_ENV, "ADMIN_BOOTSTRAP_KEY")

    sessions = ensure_users_and_login(admin_bootstrap_key)

    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cleanup_old_seed_rows(cur)

        cur.execute(
            """
            SELECT email, id, full_name
            FROM users
            WHERE email IN (%s, %s, %s, %s)
            """,
            tuple([u["email"] for u in SEED_USERS]),
        )
        users = {row[0]: {"id": str(row[1]), "name": row[2]} for row in cur.fetchall()}
        missing = [u["email"] for u in SEED_USERS if u["email"] not in users]
        if missing:
            raise RuntimeError(f"Missing users after registration: {missing}")

        call_ids = seed_complaints(
            cur,
            citizen_id=users["seed.citizen@complaints.com"]["id"],
            officer_id=users["seed.officer@complaints.com"]["id"],
            officer_name=users["seed.officer@complaints.com"]["name"],
        )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

    # Submit feedback for resolved + closed complaints (through API, end-to-end).
    citizen_token = sessions["seed.citizen@complaints.com"]["access_token"]
    submit_feedback(citizen_token, call_ids[0], 5, "Issue resolved quickly. Great support.")
    submit_feedback(citizen_token, call_ids[3], 4, "Problem fixed, please improve follow-up communication.")

    print("\n=== Seed Completed (End-to-End) ===")
    print(f"Citizen login:  seed.citizen@complaints.com / {SEED_PASSWORD}")
    print(f"Officer login:  seed.officer@complaints.com / {SEED_PASSWORD}")
    print(f"Operator login: seed.operator@complaints.com / {SEED_PASSWORD}")
    print(f"Admin login:    seed.admin@complaints.com / {SEED_PASSWORD}")
    print(f"Seeded complaints: {len(call_ids)}")
    print("Created statuses: ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED")
    print("Submitted feedback for resolved/closed complaints.")


if __name__ == "__main__":
    main()

