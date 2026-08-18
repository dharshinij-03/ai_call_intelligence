"""Department master data and SLA rules from
backend/asset/AI-Powered Citizen Call Intelligence Platform.pdf (sections 2-14).

Department names here must match call-analysis-service.schemas.Department and
user-management-service.schemas.Department exactly — that's how a complaint's
AI-assigned department name gets mapped to an official department ID here.
"""

from typing import Optional, TypedDict


class Department(TypedDict):
    id: str
    code: str
    name: str


DEPARTMENTS: list[Department] = [
    {"id": "D001", "code": "WATER", "name": "Water Supply & Sewerage"},
    {"id": "D002", "code": "SANITATION", "name": "Sanitation & Solid Waste"},
    {"id": "D003", "code": "ROADS_PWD", "name": "Roads & Public Works"},
    {"id": "D004", "code": "ELECTRICITY", "name": "Electricity & Street Lighting"},
    {"id": "D005", "code": "TRANSPORT", "name": "Public Transport"},
    {"id": "D006", "code": "TRAFFIC", "name": "Traffic Management"},
    {"id": "D007", "code": "HEALTH", "name": "Public Health"},
    {"id": "D008", "code": "DISASTER", "name": "Emergency & Disaster Management"},
    {"id": "D009", "code": "POLICE", "name": "Police & Public Safety"},
    {"id": "D010", "code": "MUNICIPAL", "name": "Municipal Services"},
    {"id": "D011", "code": "ENVIRONMENT", "name": "Environment"},
    {"id": "D012", "code": "REVENUE_ADMIN", "name": "Revenue & Civic Administration"},
]

NAME_TO_DEPARTMENT: dict[str, Department] = {d["name"]: d for d in DEPARTMENTS}
ID_TO_DEPARTMENT: dict[str, Department] = {d["id"]: d for d in DEPARTMENTS}

# Only D001-D003 have an explicit SLA table in the source document (section 3-5).
# Every other department falls back to SLA_HOURS_DEFAULT, modeled on that same
# pattern — the doc doesn't specify exact hours for D004-D012.
SLA_HOURS_DEFAULT: dict[str, int] = {"critical": 4, "high": 12, "medium": 24, "low": 72}

SLA_HOURS_BY_DEPARTMENT_ID: dict[str, dict[str, int]] = {
    "D001": {"critical": 4, "high": 12, "medium": 24, "low": 72},
    "D002": {"critical": 4, "high": 12, "medium": 24, "low": 48},
    "D003": {"critical": 4, "high": 12, "medium": 48, "low": 24 * 7},
}


def get_sla_hours(department_id: str, priority: str) -> int:
    table = SLA_HOURS_BY_DEPARTMENT_ID.get(department_id, SLA_HOURS_DEFAULT)
    return table.get(priority, SLA_HOURS_DEFAULT["low"])


def department_id_for_name(name: str) -> Optional[str]:
    dept = NAME_TO_DEPARTMENT.get(name)
    return dept["id"] if dept else None
