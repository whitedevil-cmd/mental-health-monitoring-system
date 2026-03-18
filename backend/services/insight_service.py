"""Service layer for dashboard-ready insight orchestration."""

from __future__ import annotations

from backend.models.schemas.insight import InsightResponse
from backend.services.response_service import ResponseService
from backend.services.trend_service import TrendService


class InsightService:
    """Coordinate trend building and supportive message generation."""

    def __init__(
        self,
        trend_service: TrendService | None = None,
        response_service: ResponseService | None = None,
    ) -> None:
        self._trend_service = trend_service or TrendService()
        self._response_service = response_service or ResponseService()

    async def get_user_insights(self, user_id: str, session: object | None = None) -> InsightResponse:  # noqa: ARG002
        """Build the dashboard insight payload for a user."""
        insight = await self._trend_service.build_insights(user_id=user_id, session=session)
        insight.supportive_message = await self._response_service.generate_supportive_message(insight)
        return insight
