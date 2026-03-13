"""
Pytest configuration and shared fixtures for the backend project.

This module ensures the project root is on `sys.path` so that the
`backend` package can be imported reliably, and provides a shared
FastAPI TestClient for API tests.
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


# Ensure project root (containing `backend/`) is on sys.path for imports.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.main import app  # noqa: E402  (import after sys.path tweak)
from backend.database.base import Base  # noqa: E402
from backend.database.session import engine  # noqa: E402
import asyncio  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def create_test_database() -> None:
    """
    Ensure database tables exist before any tests run.

    While the FastAPI lifespan also creates tables, this fixture makes
    the behavior explicit for test runs and avoids race conditions.
    """

    async def _init_models() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_init_models())


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Return a TestClient bound to the FastAPI app."""
    return TestClient(app)



