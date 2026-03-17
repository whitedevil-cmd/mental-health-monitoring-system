"""
Unit tests for the ResponseService.

External LLM calls are not implemented yet, but this service represents
the integration point and must be easy to mock.
"""

import pytest

from backend.models.schemas.insight import InsightResponse
from backend.services.response_service import ResponseService


@pytest.mark.asyncio
async def test_response_service_returns_non_empty_message():
    """ResponseService should always return a non-empty supportive string."""
    service = ResponseService()
    insight = InsightResponse(user_id="user-1", trend=[], supportive_message=None)

    message = await service.generate_supportive_message(insight)

    assert isinstance(message, str)
    assert message.strip() != ""

