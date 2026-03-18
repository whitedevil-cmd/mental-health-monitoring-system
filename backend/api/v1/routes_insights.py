"""API routes for emotion trends and dashboard insights (v1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.models.schemas.emotion import EmotionInsightsSummary
from backend.models.schemas.insight import InsightResponse, TrendAnalysisResponse
from backend.services.dashboard_service import DashboardService
from backend.services.insight_service import InsightService
from backend.services.trend_service import TrendService

router = APIRouter(prefix="/insights", tags=["insights"])


def get_trend_service() -> TrendService:
    """Dependency wrapper for TrendService."""
    return TrendService()


def get_insight_service() -> InsightService:
    """Dependency wrapper for InsightService."""
    return InsightService()


def get_dashboard_service() -> DashboardService:
    """Dependency wrapper for dashboard analytics."""
    return DashboardService()


@router.get(
    "",
    response_model=EmotionInsightsSummary,
)
async def get_insights(
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> EmotionInsightsSummary:
    """Return dashboard-ready analytics from stored emotion logs."""
    return await dashboard_service.get_insights()


@router.get(
    "/emotion-trend",
    response_model=TrendAnalysisResponse,
)
async def get_emotion_trend(
    user_id: str,
    trend_service: TrendService = Depends(get_trend_service),
) -> TrendAnalysisResponse:
    """Run the trend analysis module over the last 7 days of emotion logs."""
    return await trend_service.analyze_user_trend(user_id=user_id)


@router.get(
    "/{user_id}",
    response_model=InsightResponse,
)
async def get_user_insights(
    user_id: str,
    insight_service: InsightService = Depends(get_insight_service),
) -> InsightResponse:
    """Return emotion trends and supportive text for a user."""
    return await insight_service.get_user_insights(user_id=user_id)
