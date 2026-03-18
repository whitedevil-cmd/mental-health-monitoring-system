"""
Pytest configuration and shared fixtures for the backend project.

This module ensures the project root is on `sys.path` so that the
`backend` package can be imported reliably, and provides a shared
FastAPI TestClient for API tests.
"""

import sys
import site
from pathlib import Path

import pytest
import shutil
import uuid

# Ensure local/venv site-packages are available for dependencies like httpx/idna.
venv_site = Path(__file__).resolve().parents[1] / ".venv" / "Lib" / "site-packages"
if venv_site.exists() and str(venv_site) not in sys.path:
    sys.path.append(str(venv_site))

# Avoid permission issues when system site-packages include restricted dist-info.
system_site = Path(sys.base_prefix) / "Lib" / "site-packages"
if str(system_site) in sys.path:
    sys.path.remove(str(system_site))

user_site = site.getusersitepackages()
if user_site and user_site not in sys.path:
    sys.path.append(user_site)

from fastapi.testclient import TestClient


# Ensure project root (containing `backend/`) is on sys.path for imports.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.main import app  # noqa: E402  (import after sys.path tweak)


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Return a TestClient bound to the FastAPI app."""
    return TestClient(app)


@pytest.fixture()
def tmp_path() -> Path:
    """Provide a writable temp directory without relying on pytest's tmpdir plugin."""
    base = Path(__file__).resolve().parents[1] / "pytest_tmp_dir"
    base.mkdir(parents=True, exist_ok=True)
    path = base / f"tmp_{uuid.uuid4().hex}"
    path.mkdir(parents=True, exist_ok=True)
    try:
        yield path
    finally:
        shutil.rmtree(path, ignore_errors=True)



