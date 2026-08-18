from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

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

# No ORM models, no Base, no create_all: this service owns no tables. It only
# reads tables that call-management-service / call-analysis-service /
# complaint-assignment-service / user-management-service already own and
# migrate — creating or altering schema from here would be a layering
# violation even though everything lives in one physical Neon database.
engine = create_async_engine(ASYNC_DATABASE_URL, connect_args={"ssl": True}, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
