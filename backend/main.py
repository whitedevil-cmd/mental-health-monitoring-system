"""
Application entrypoint for the AI Mental Health Monitoring System.

This module wires together configuration, logging, database startup
logic, and API routers into a single FastAPI application object.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncConnection

from backend.api import emotion_routes
from backend.api.v1 import routes_audio, routes_emotions, routes_insights, routes_voice_stream
from backend.database.base import Base
from backend.database.session import engine
from backend.services.audio_service import AudioService
from backend.utils.config import get_settings
from backend.utils.errors import ServiceError
from backend.utils.logging import configure_logging

load_dotenv()

logger = logging.getLogger(__name__)


async def _sqlite_table_columns(conn: AsyncConnection, table_name: str) -> set[str]:
    """Return existing SQLite table column names for a table."""
    result = await conn.exec_driver_sql(f"PRAGMA table_info({table_name})")
    return {str(row[1]) for row in result.fetchall()}


async def _ensure_sqlite_transcript_columns(conn: AsyncConnection) -> None:
    """Safely add transcript columns for existing SQLite databases."""
    table_names = ("emotion_readings", "emotion_logs")
    for table_name in table_names:
        columns = await _sqlite_table_columns(conn, table_name)
        if "transcript" not in columns:
            logger.info("Applying SQLite schema update: adding transcript column to %s", table_name)
            await conn.exec_driver_sql(
                f"ALTER TABLE {table_name} ADD COLUMN transcript TEXT"
            )


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Lifespan context for startup and shutdown hooks."""
    settings = get_settings()
    configure_logging(level=settings.LOG_LEVEL)
    logger.info("Starting %s in %s mode", settings.APP_NAME, settings.ENVIRONMENT)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if engine.url.get_backend_name() == "sqlite":
            try:
                await _ensure_sqlite_transcript_columns(conn)
            except Exception as exc:  # pragma: no cover - startup schema patch safety
                logger.warning("SQLite transcript schema update skipped: %s", exc)

    from backend.services.audio_cleanup import cleanup_old_audio_files

    logger.info("Running audio cleanup check on startup...")
    cleanup_old_audio_files()

    # Preload cached ML models once during startup to avoid cold-start latency.
    try:
        from backend.services.emotion_detector import get_model as get_emotion_model

        logger.info("Preloading audio emotion model...")
        get_emotion_model()
        logger.info("Audio emotion model ready.")
    except Exception as exc:  # pragma: no cover - environment-dependent model init
        logger.warning("Failed to initialize audio emotion model: %s", exc)

    try:
        from backend.services.whisper_transcriber import get_model as get_whisper_model

        logger.info("Preloading whisper model...")
        get_whisper_model()
        logger.info("Whisper model ready.")
    except Exception as exc:  # pragma: no cover - environment-dependent model init
        logger.warning("Failed to initialize whisper model: %s", exc)

    try:
        from backend.services.text_emotion_detector import get_model as get_text_emotion_model

        logger.info("Preloading text emotion model...")
        get_text_emotion_model()
        logger.info("Text emotion model ready.")
    except Exception as exc:  # pragma: no cover - environment-dependent model init
        logger.warning("Failed to initialize text emotion model: %s", exc)

    yield
    logger.info("Application shutdown complete")


def _build_error_response(message: str, details: str | None = None) -> dict[str, str | None]:
    """Return a backward-compatible structured error payload."""
    return {
        "status": "error",
        "message": message,
        "details": details,
        "error": message,
    }


def create_app() -> FastAPI:
    """Application factory function."""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        debug=settings.DEBUG,
        lifespan=lifespan,
    )

    @app.exception_handler(ServiceError)
    async def service_error_handler(request: Request, exc: ServiceError):  # noqa: ARG001
        logger.warning("Service error handled: %s", exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_response(),
        )

    @app.exception_handler(HTTPException)
    async def custom_http_exception_handler(request: Request, exc: HTTPException):  # noqa: ARG001
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(
            status_code=exc.status_code,
            content=_build_error_response(detail),
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):  # noqa: ARG001
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content=_build_error_response("An internal server error occurred."),
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:8080", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(routes_audio.router, prefix="/api/v1")
    app.include_router(routes_emotions.router, prefix="/api/v1")
    app.include_router(routes_insights.router, prefix="/api/v1")
    app.include_router(routes_voice_stream.router, prefix="/api/v1")
    app.include_router(emotion_routes.router)

    @app.get("/health")
    def health() -> dict[str, str]:
        """Quick connectivity check."""
        return {"status": "ok"}

    @app.post("/upload-audio", status_code=201)
    async def upload_audio_alias(
        file: UploadFile = File(..., description="WAV audio file"),
    ) -> dict[str, str]:
        """Top-level alias used by the frontend for WAV uploads."""
        service = AudioService()
        return await service.handle_wav_upload(file=file)

    return app


app = create_app()
