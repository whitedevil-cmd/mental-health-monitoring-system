"""
High-level database utilities.

This module provides convenience helpers for initializing the database
schema and for obtaining sessions in non-FastAPI contexts (e.g. scripts
or background workers).

It builds on top of the lower-level engine/session definitions in
`backend.database.session`.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import Base
from backend.database.session import AsyncSessionLocal, engine


async def init_db() -> None:
    """
    Initialize database schema if it does not yet exist.

    This function is idempotent: calling it multiple times will not
    recreate or drop existing tables. It simply ensures that all ORM
    models registered on `Base` have corresponding tables.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield a single AsyncSession instance.

    This helper mirrors FastAPI's dependency pattern but can be used in
    standalone scripts or background tasks.
    """
    async with AsyncSessionLocal() as session:
        yield session

