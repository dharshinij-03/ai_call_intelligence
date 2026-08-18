"""Department master data from
backend/asset/AI-Powered Citizen Call Intelligence Platform.pdf (section 2).

Duplicated by value from complaint-assignment-service/app/departments.py —
same convention as elsewhere in this project (each service keeps its own
copy of shared reference data rather than a shared package)."""

DEPARTMENTS = [
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

ID_TO_DEPARTMENT = {d["id"]: d for d in DEPARTMENTS}
NAME_TO_DEPARTMENT = {d["name"]: d for d in DEPARTMENTS}
