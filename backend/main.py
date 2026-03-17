"""
Application entrypoint for the AI Mental Health Monitoring System.

This module wires together configuration, logging, database startup
logic, and API routers into a single FastAPI application object.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import os
import time

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import AsyncConnection

from backend.api import emotion_routes
from backend.api.v1 import routes_audio, routes_emotions, routes_insights, routes_transcribe, routes_voice_stream
from backend.database.base import Base
from backend.database.session import engine, get_session
from backend.models.schemas.emotion import EmotionHistoryItem, EmotionInsightsSummary
from backend.services.audio_service import AudioService
from backend.services.dashboard_service import DashboardService
from backend.services.emotion_detection_service import EmotionDetectionService
from backend.services.emotion_storage import save_emotion_result
from backend.services.support_generator import SupportGeneratorService
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


class AnalyzeAudioResponse(BaseModel):
    """Response body for raw audio analysis."""

    transcript: str
    emotion: str
    confidence: float
    probabilities: dict[str, float]
    response: str


class GenerateSupportRequest(BaseModel):
    """Request body for generating a supportive message."""

    emotion: str = Field(..., min_length=1)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class GenerateSupportResponse(BaseModel):
    """Response body for generating a supportive message."""

    message: str


def _trend_summary_from_confidence(emotion: str, confidence: float | None) -> str:
    """Derive a lightweight trend summary from confidence."""
    normalized = emotion.strip().lower() or "neutral"
    if confidence is None:
        return f"mixed pattern with recent {normalized}"
    if confidence >= 0.7:
        return f"mostly {normalized}"
    if confidence >= 0.5:
        return f"recent {normalized}"
    return f"mixed pattern with recent {normalized}"


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

    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "Request failed endpoint=%s method=%s duration_ms=%.2f",
                request.url.path,
                request.method,
                duration_ms,
            )
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "Request completed endpoint=%s method=%s status=%s duration_ms=%.2f",
            request.url.path,
            request.method,
            response.status_code,
            duration_ms,
        )
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://mental-health-monitoring-system.vercel.app",
            "https://mental-health-monitoring-system2.vercel.app",
        ],
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(routes_audio.router, prefix="/api/v1")
    app.include_router(routes_emotions.router, prefix="/api/v1")
    app.include_router(routes_insights.router, prefix="/api/v1")
    app.include_router(routes_voice_stream.router, prefix="/api/v1")
    app.include_router(routes_transcribe.router)
    app.include_router(emotion_routes.router)

    @app.get("/health")
    def health() -> dict[str, str]:
        """Quick connectivity check."""
        return {"status": "ok"}

    @app.get("/insights", response_model=EmotionInsightsSummary)
    async def insights_alias(
        session: AsyncSession = Depends(get_session),
    ) -> EmotionInsightsSummary:
        """Alias for Lovable dashboard insights."""
        return await DashboardService().get_insights(session=session)

    @app.get("/history", response_model=list[EmotionHistoryItem])
    async def history_alias(
        session: AsyncSession = Depends(get_session),
    ) -> list[EmotionHistoryItem]:
        """Alias for Lovable history requests."""
        return await DashboardService().get_history(session=session)

    @app.get("/debug/routes")
    def debug_routes() -> dict[str, list[dict[str, object]]]:
        """List registered application routes for debugging."""
        routes = []
        for route in app.routes:
            methods = sorted(route.methods) if getattr(route, "methods", None) else []
            routes.append({"path": route.path, "name": route.name, "methods": methods})
        return {"routes": routes}

    @app.get("/debug/config")
    def debug_config() -> dict[str, object]:
        """Expose non-sensitive configuration and env presence for debugging."""
        settings = get_settings()
        return {
            "app_name": settings.APP_NAME,
            "environment": settings.ENVIRONMENT,
            "debug": settings.DEBUG,
            "database_url": settings.DATABASE_URL,
            "audio_storage_dir": settings.AUDIO_STORAGE_DIR,
            "log_level": settings.LOG_LEVEL,
            "model_name": settings.MODEL_NAME,
            "llm_provider": settings.LLM_PROVIDER,
            "env": {
                "API_KEY": bool(os.getenv("API_KEY")),
                "LLM_API_KEY": bool(os.getenv("LLM_API_KEY")),
                "ELEVENLABS_API_KEY": bool(os.getenv("ELEVENLABS_API_KEY")),
            },
        }

    @app.post("/upload-audio", status_code=201)
    async def upload_audio_alias(
        file: UploadFile = File(..., description="WAV audio file"),
    ) -> dict[str, str]:
        """Top-level alias for WAV uploads (kept for backward compatibility)."""
        service = AudioService()
        return await service.handle_wav_upload(file=file)

    @app.post(
        "/analyze-audio",
        response_model=AnalyzeAudioResponse,
        status_code=status.HTTP_200_OK,
    )
    async def analyze_audio_alias(
        file: UploadFile = File(..., description="WAV audio file"),
        session: AsyncSession = Depends(get_session),
    ) -> AnalyzeAudioResponse:
        """Accept a WAV upload and return emotion probabilities."""
        logger.info("analyze-audio endpoint called with filename=%s content_type=%s", file.filename, file.content_type)
        upload_result = await AudioService().handle_wav_upload(file=file)
        detection = EmotionDetectionService().detect_from_audio_path(upload_result["file_path"])
        confidence = detection.scores.get(detection.dominant_emotion, 0.0)
        await save_emotion_result(
            session=session,
            dominant_emotion=detection.dominant_emotion,
            scores=detection.scores,
            transcript=detection.transcript,
        )
        trend_summary = _trend_summary_from_confidence(detection.dominant_emotion, confidence)
        response_message = SupportGeneratorService().generate_support_message(
            current_emotion=detection.dominant_emotion,
            trend_summary=trend_summary,
            memory_context=None,
        )
        return AnalyzeAudioResponse(
            transcript=detection.transcript,
            emotion=detection.dominant_emotion,
            confidence=confidence,
            probabilities=detection.scores,
            response=response_message,
        )

    @app.post(
        "/generate-support",
        response_model=GenerateSupportResponse,
        status_code=status.HTTP_200_OK,
    )
    async def generate_support_alias(
        payload: GenerateSupportRequest,
    ) -> GenerateSupportResponse:
        """Generate a short supportive message for the supplied emotion."""
        logger.info("generate-support endpoint called with emotion=%s confidence=%s", payload.emotion, payload.confidence)
        trend_summary = _trend_summary_from_confidence(payload.emotion, payload.confidence)
        message = SupportGeneratorService().generate_support_message(
            current_emotion=payload.emotion,
            trend_summary=trend_summary,
            memory_context=None,
        )
        return GenerateSupportResponse(message=message)

    return app


app = create_app()
