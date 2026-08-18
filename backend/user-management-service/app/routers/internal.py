"""Machine-to-machine endpoints for other backend services — gated by a
shared X-Service-Key header rather than a user JWT, since the caller here
is a service, not a logged-in person."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User, UserRole
from app.schemas import UserOut

router = APIRouter()


def require_service_key(x_service_key: str = Header(...)) -> None:
    settings = get_settings()
    if x_service_key != settings.service_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service key")


@router.get("/officers", response_model=List[UserOut], dependencies=[Depends(require_service_key)])
async def list_officers(department: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.role == UserRole.officer, User.is_active.is_(True))
    if department:
        stmt = stmt.where(User.department == department)
    return (await db.scalars(stmt)).all()
