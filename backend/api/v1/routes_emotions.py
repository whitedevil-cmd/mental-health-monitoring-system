"""API routes for emotion detection and retrieval (v1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.session import get_session
from backend.models.schemas.emotion import EmotionHistoryItem, EmotionReadingCreate, EmotionReadingRead
from backend.services.dashboard_service import DashboardService
from backend.services.emotion_service import EmotionService

router = APIRouter(prefix="/emotions", tags=["emotions"])


def get_emotion_service() -> EmotionService:
    """Dependency wrapper for EmotionService."""
    return EmotionService()


def get_dashboard_service() -> DashboardService:
    """Dependency wrapper for emotion history reads."""
    return DashboardService()


@router.get(
    "",
    response_model=list[EmotionHistoryItem],
)
async def get_emotion_history(
    session: AsyncSession = Depends(get_session),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> list[EmotionHistoryItem]:
    """Return stored session history for dashboard clients."""
    return await dashboard_service.get_history(session=session)


@router.post(
    "/analyze",
    response_model=EmotionReadingRead,
    status_code=status.HTTP_201_CREATED,
)
async def analyze_audio_emotion(
    payload: EmotionReadingCreate,
    session: AsyncSession = Depends(get_session),
    service: EmotionService = Depends(get_emotion_service),
) -> EmotionReadingRead:
    """Persist an analyzed emotion reading."""
    return await service.analyze_and_store(session=session, payload=payload)
