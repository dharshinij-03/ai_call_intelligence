"""Fetches active officers for a department from user-management-service's
internal (service-to-service) endpoint."""

from dataclasses import dataclass
from typing import List
from uuid import UUID

import httpx

from app.config import get_settings


@dataclass
class Officer:
    id: UUID
    full_name: str


async def fetch_available_officers(department_name: str) -> List[Officer]:
    settings = get_settings()
    url = f"{settings.user_management_service_url}/internal/officers"

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            url,
            params={"department": department_name},
            headers={"X-Service-Key": settings.service_api_key},
        )
    response.raise_for_status()

    return [Officer(id=UUID(o["id"]), full_name=o["full_name"]) for o in response.json()]
