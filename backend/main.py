"""
Application entrypoint for the AI Mental Health Monitoring System.

This module wires together configuration, logging, database startup
logic, and API routers into a single FastAPI application object.
"""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI

from backend.api.v1 import routes_audio, routes_emotions, routes_insights
from backend.database.session import engine
from backend.database.base import Base
from backend.utils.config import get_settings
from backend.utils.logging import configure_logging


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """
    Lifespan context for startup and shutdown hooks.

    On startup, this ensures that database tables exist. In production
    you may prefer to manage schema using migrations instead.
    """
    settings = get_settings()
    configure_logging(level="DEBUG" if settings.DEBUG else "INFO")
    logger.info("Starting %s in %s mode", settings.APP_NAME, settings.ENVIRONMENT)

    # Minimal auto-create tables for demo/development only.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    """
    Application factory function.

    This pattern makes the app easier to test and configure.
    """
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        debug=settings.DEBUG,
        lifespan=lifespan,
    )

    # Include versioned routers
    app.include_router(routes_audio.router, prefix="/api/v1")
    app.include_router(routes_emotions.router, prefix="/api/v1")
    app.include_router(routes_insights.router, prefix="/api/v1")

    return app


app = create_app()

"""
Application entrypoint for the AI Mental Health Monitoring System.

This module wires together configuration, logging, database startup
logic, and API routers into a single FastAPI application object.
"""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI

from backend.api.v1 import routes_audio, routes_emotions, routes_insights
from backend.database.session import engine
from backend.database.base import Base
from backend.utils.config import get_settings
from backend.utils.logging import configure_logging


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """
    Lifespan context for startup and shutdown hooks.

    On startup, this ensures that database tables exist. In production
    you may prefer to manage schema using migrations instead.
    """
    settings = get_settings()
    configure_logging(level="DEBUG" if settings.DEBUG else "INFO")
    logger.info("Starting %s in %s mode", settings.APP_NAME, settings.ENVIRONMENT)

    # Minimal auto-create tables for demo/development only.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    """
    Application factory function.

    This pattern makes the app easier to test and configure.
    """
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        debug=settings.DEBUG,
        lifespan=lifespan,
    )

    # Include versioned routers
    app.include_router(routes_audio.router, prefix="/api/v1")
    app.include_router(routes_emotions.router, prefix="/api/v1")
    app.include_router(routes_insights.router, prefix="/api/v1")

    return app


app = create_app()

