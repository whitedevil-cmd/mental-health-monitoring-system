from __future__ import annotations

import pytest

from backend.services.dashboard_service import DashboardService


class FakeStorageBackend:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.calls: list[dict] = []

    async def select_rows(
        self,
        table: str,
        *,
        limit: int | None = None,
        eq_filters: dict | None = None,
        gte_filters: dict | None = None,
        order_by: str | None = None,
        desc: bool = False,
    ) -> list[dict]:
        self.calls.append(
            {
                "table": table,
                "limit": limit,
                "eq_filters": eq_filters,
                "gte_filters": gte_filters,
                "order_by": order_by,
                "desc": desc,
            }
        )
        return self.rows


@pytest.mark.asyncio
async def test_get_history_reads_from_emotion_readings_and_maps_fields() -> None:
    storage = FakeStorageBackend(
        [
            {
                "created_at": "2026-03-22T15:52:06.306408",
                "emotion_label": "anger",
                "confidence": 0.452736407518387,
                "transcript": "So she scolded me.",
            }
        ]
    )
    service = DashboardService(data_service=storage)

    history = await service.get_history(user_id="user-1")

    assert storage.calls == [
        {
            "table": "emotion_readings",
            "limit": None,
            "eq_filters": {"user_id": "user-1"},
            "gte_filters": None,
            "order_by": "created_at",
            "desc": True,
        }
    ]
    assert history[0].timestamp.isoformat() == "2026-03-22T15:52:06.306408"
    assert history[0].emotion == "anger"
    assert history[0].confidence == 0.452736407518387
    assert history[0].transcript == "So she scolded me."
