import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class UserRole(str, enum.Enum):
    citizen = "citizen"
    operator = "operator"
    officer = "officer"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    email = Column(String, unique=True, nullable=False, index=True)
    phone_number = Column(String, nullable=True)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)

    role = Column(Enum(UserRole, name="user_role"), nullable=False, default=UserRole.citizen)
    # Civic department this user handles — only meaningful for role=officer
    # (matches the department taxonomy in call-analysis-service).
    department = Column(String, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
