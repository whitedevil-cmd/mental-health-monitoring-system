"""Database engine and session management."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.database.config import get_database_url

DATABASE_URL = get_database_url()

engine_kwargs = {
    "echo": False,
    "future": True,
}
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    # Ensure we never default to Supabase internal schemas.
    engine_kwargs["connect_args"] = {
        "server_settings": {"search_path": "public"},
    }

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
