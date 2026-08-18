"""Verifies JWTs issued by user-management-service locally (shared
JWT_SECRET_KEY) rather than calling back into it on every request — the
integration path that service's own README anticipated."""

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, WebSocket, status
from fastapi.security import OAuth2PasswordBearer

from app.config import get_settings

# tokenUrl points at user-management-service's real login endpoint — this
# service never issues tokens itself, only verifies them.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost:8003/auth/login", auto_error=False)


@dataclass
class CurrentUser:
    id: UUID
    role: str
    name: str


def _decode(token: str) -> CurrentUser:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return CurrentUser(id=UUID(payload["sub"]), role=payload["role"], name=payload.get("name", "Unknown"))
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> CurrentUser:
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return _decode(token)


def require_role(*roles: str):
    async def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return checker


async def get_current_user_ws(websocket: WebSocket, token: str) -> CurrentUser:
    """WebSocket routes can't use the Authorization header via Depends the
    same way — token arrives as a query param instead; same verification."""
    try:
        return _decode(token)
    except HTTPException:
        await websocket.close(code=4401, reason="Invalid token")
        raise
