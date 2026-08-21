import uuid
from datetime import datetime

import psycopg2


def read_database_url() -> str:
    # All backend services read the same DATABASE_URL from their local .env files.
    env_path = "backend/admin-service/.env"
    db_url = None
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("DATABASE_URL="):
                db_url = line.split("=", 1)[1].strip()
                break

    if not db_url:
        raise RuntimeError(f"Could not find DATABASE_URL in {env_path}")
    return db_url


def main() -> None:
    database_url = read_database_url()

    citizen_id = uuid.uuid4()
    citizen_id_str = str(citizen_id)
    citizen_name = "Seed Citizen"

    # Seed clusters that will group together when rounded to 3 decimals (~100m).
    clusters = [
        {
            "center": (12.9716, 77.5946),  # Cluster A
            "count": 6,
            "department": "Roads",
            "critical": 3,
        },
        {
            "center": (12.9760, 77.6080),  # Cluster B
            "count": 3,
            "department": "Water",
            "critical": 0,
        },
        {
            "center": (12.9650, 77.5850),  # Cluster C
            "count": 2,
            "department": "Health",
            "critical": 1,
        },
    ]

    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    cur = conn.cursor()

    inserted = 0
    for cluster in clusters:
        base_lat, base_lng = cluster["center"]
        count = int(cluster["count"])
        critical = int(cluster["critical"])
        dept = cluster["department"]

        for i in range(count):
            # Small deterministic offsets so points still round into the same 3-decimal cell.
            # 0.00035 deg ~ 38m in latitude.
            lat_offset = (i - count / 2) * 0.00035
            lng_offset = (count / 2 - i) * 0.00035

            cs_id = uuid.uuid4()
            call_id = uuid.uuid4()

            lat = base_lat + lat_offset
            lng = base_lng + lng_offset

            urgency = "critical" if i < critical else "normal"

            # 1) citizen-service side: location-carrying call session
            cur.execute(
                """
                INSERT INTO call_sessions (id, citizen_id, citizen_name, status, latitude, longitude, location_accuracy)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (str(cs_id), citizen_id_str, citizen_name, "waiting", lat, lng, 30.0),
            )

            # 2) call-management-service side: call linked to that citizen session via caller_id
            cur.execute(
                """
                INSERT INTO calls (id, source, status, caller_id, started_at, ended_at, latitude, longitude)
                VALUES (%s, %s, %s, %s, now(), now(), %s, %s)
                """,
                (str(call_id), "live", "completed", str(cs_id), None, None),
            )

            # 3) call-analysis-service side: minimal analysis row so heatmap popup can show dominant_department
            analysis_id = uuid.uuid4()
            cur.execute(
                """
                INSERT INTO call_analysis
                  (id, call_id, summary, sentiment, urgency, department, transcript_snapshot, tags, is_duplicate)
                VALUES
                  (%s, %s, %s, %s, %s, %s, %s, ARRAY[]::text[], false)
                """,
                (
                    str(analysis_id),
                    str(call_id),
                    "Seeded complaint for heatmap testing",
                    "negative",
                    urgency,
                    dept,
                    "Seed transcript snapshot",
                ),
            )

            inserted += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"Seeded {inserted} heatmap datapoints." )


if __name__ == "__main__":
    main()

