"""
Database engine and session management.

This module provides an async SQLAlchemy engine and a dependency
`get_session` that FastAPI routes can use to interact with the DB.
The actual business logic should live in repository and service layers.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.database.config import get_database_url

DATABASE_URL = get_database_url()

engine = create_async_engine(DATABASE_URL, echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields a single database session.

    This function should be used via `Depends(get_session)` inside route
    handlers or services that need DB access.
    """
    async with AsyncSessionLocal() as session:
        yield session

"""
Database engine and session management.

This module provides an async SQLAlchemy engine and a dependency
`get_session` that FastAPI routes can use to interact with the DB.
The actual business logic should live in repository and service layers.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.database.config import get_database_url

DATABASE_URL = get_database_url()

engine = create_async_engine(DATABASE_URL, echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields a single database session.

    This function should be used via `Depends(get_session)` inside route
    handlers or services that need DB access.
    """
    async with AsyncSessionLocal() as session:
        yield session

