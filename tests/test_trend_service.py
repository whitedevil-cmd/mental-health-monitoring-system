"""
Unit tests for TrendService.

These tests validate that the service correctly transforms repository
results into InsightResponse objects, using a mocked repository to keep
the module independent from the real database.
"""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.models.schemas.insight import InsightResponse
from backend.services.trend_service import TrendService


@pytest.mark.asyncio
async def test_trend_service_builds_insight_from_readings():
    """TrendService should convert emotion readings into trend points."""
    # Prepare fake reading objects with the attributes used by TrendService
    fake_readings = [
        SimpleNamespace(
            created_at=datetime.now(timezone.utc),
            emotion_label="happy",
            confidence=0.9,
        )
    ]

    mock_repo = AsyncMock()
    mock_repo.list_readings_for_user = AsyncMock(return_value=fake_readings)

    async def repo_factory(session):  # noqa: ARG001
        return mock_repo

    service = TrendService()

    with patch(
        "backend.services.trend_service.EmotionRepository",
        autospec=True,
    ) as repo_cls:
        repo_cls.return_value = mock_repo
        insight: InsightResponse = await service.build_insights(
            session=None,  # type: ignore[arg-type]
            user_id="user-1",
        )

    assert insight.user_id == "user-1"
    assert len(insight.trend) == 1
    point = insight.trend[0]
    assert point.dominant_emotion == "happy"
    assert point.confidence == 0.9

