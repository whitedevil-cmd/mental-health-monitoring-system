"""
API routes for emotion trends and supportive insights (v1).

These routes expose higher-level analytics that frontend dashboards can
use to show charts and textual guidance to users.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.session import get_session
from backend.models.schemas.insight import InsightResponse
from backend.services.response_service import ResponseService
from backend.services.trend_service import TrendService

router = APIRouter(prefix="/insights", tags=["insights"])


def get_trend_service() -> TrendService:
    """Dependency wrapper for TrendService."""
    return TrendService()


def get_response_service() -> ResponseService:
    """Dependency wrapper for ResponseService."""
    return ResponseService()


@router.get(
    "/{user_id}",
    response_model=InsightResponse,
)
async def get_user_insights(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    trend_service: TrendService = Depends(get_trend_service),
    response_service: ResponseService = Depends(get_response_service),
) -> InsightResponse:
    """
    Return emotion trends and supportive text for a user.

    The supportive message is currently a static placeholder; you can
    later connect this to a real LLM provider.
    """
    insight = await trend_service.build_insights(session=session, user_id=user_id)
    message = await response_service.generate_supportive_message(insight)
    insight.supportive_message = message
    return insight

"""
API routes for emotion trends and supportive insights (v1).

These routes expose higher-level analytics that frontend dashboards can
use to show charts and textual guidance to users.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.session import get_session
from backend.models.schemas.insight import InsightResponse, TrendAnalysisResponse
from backend.services.response_service import ResponseService
from backend.services.trend_service import TrendService

router = APIRouter(prefix="/insights", tags=["insights"])


def get_trend_service() -> TrendService:
    """Dependency wrapper for TrendService."""
    return TrendService()


def get_response_service() -> ResponseService:
    """Dependency wrapper for ResponseService."""
    return ResponseService()


@router.get(
    "/emotion-trend",
    response_model=TrendAnalysisResponse,
)
async def get_emotion_trend(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    trend_service: TrendService = Depends(get_trend_service),
) -> TrendAnalysisResponse:
    """
    Run the trend analysis module over the last 7 days of emotion logs.
    """
    return await trend_service.analyze_user_trend(session=session, user_id=user_id)


@router.get(
    "/{user_id}",
    response_model=InsightResponse,
)
async def get_user_insights(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    trend_service: TrendService = Depends(get_trend_service),
    response_service: ResponseService = Depends(get_response_service),
) -> InsightResponse:
    """
    Return emotion trends and supportive text for a user.

    The supportive message is currently a static placeholder; you can
    later connect this to a real LLM provider.
    """
    insight = await trend_service.build_insights(session=session, user_id=user_id)
    message = await response_service.generate_supportive_message(insight)
    insight.supportive_message = message
    return insight


