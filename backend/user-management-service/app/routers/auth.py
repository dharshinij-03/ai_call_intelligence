from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas import RegisterRequest, Token, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    settings = get_settings()

    if payload.role != "citizen":
        if payload.admin_bootstrap_key != settings.admin_bootstrap_key:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Creating operator/officer/admin accounts requires a valid admin_bootstrap_key",
            )

    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=payload.email,
        phone_number=payload.phone_number,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        department=payload.department,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # OAuth2PasswordRequestForm's field is literally called "username" — we treat it as email.
    user = await db.scalar(select(User).where(User.email == form_data.username))
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    access_token = create_access_token(subject=str(user.id), role=user.role.value, name=user.full_name)
    return Token(access_token=access_token)
