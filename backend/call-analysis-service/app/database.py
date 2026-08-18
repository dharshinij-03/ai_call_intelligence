from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.config import get_settings

settings = get_settings()


def _build_async_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    query = dict(parse_qsl(parsed.query))
    query.pop("sslmode", None)
    query.pop("channel_binding", None)
    return urlunparse(
        ("postgresql+asyncpg", parsed.netloc, parsed.path, parsed.params, urlencode(query), parsed.fragment)
    )


ASYNC_DATABASE_URL = _build_async_url(settings.database_url)

engine = create_async_engine(ASYNC_DATABASE_URL, connect_args={"ssl": True}, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
