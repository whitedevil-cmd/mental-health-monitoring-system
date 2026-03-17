"""Database engine and session management."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from backend.database.config import get_database_url

DATABASE_URL = get_database_url()

engine_kwargs = {
    "echo": False,
    "future": True,
}
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    lower_url = DATABASE_URL.lower()
    uses_pooler = "pooler" in lower_url or ":6543" in lower_url
    connect_args = {
        "server_settings": {"search_path": "public"},
        # Disable asyncpg prepared statement caching to avoid PgBouncer issues.
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }
    if uses_pooler:
        # PgBouncer transaction mode + asyncpg: disable prepared statement caches.
        engine_kwargs["poolclass"] = NullPool
    engine_kwargs["connect_args"] = connect_args

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a single database session."""
    async with AsyncSessionLocal() as session:
        yield session
