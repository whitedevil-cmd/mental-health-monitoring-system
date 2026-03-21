"""Tests for the Deepgram token endpoint."""

from __future__ import annotations

from collections import deque


async def _fake_issue_deepgram_token() -> dict[str, object]:
    return {"token": "temporary-token", "expires_in": 90}


def test_deepgram_token_endpoint_returns_token(client, monkeypatch) -> None:
    from backend.services import deepgram_token_service as token_service

    token_service._token_request_history.clear()
    monkeypatch.setattr(
        "backend.main.issue_deepgram_token",
        _fake_issue_deepgram_token,
        raising=True,
    )

    response = client.get("/deepgram-token")

    assert response.status_code == 200
    assert response.json() == {"token": "temporary-token", "expires_in": 90}


def test_deepgram_token_endpoint_rate_limits_by_ip(client, monkeypatch) -> None:
    from backend.services import deepgram_token_service as token_service

    token_service._token_request_history.clear()
    monkeypatch.setattr(
        "backend.main.issue_deepgram_token",
        _fake_issue_deepgram_token,
        raising=True,
    )
    monkeypatch.setitem(
        token_service._token_request_history,
        "203.0.113.9",
        deque([0.0] * token_service.RATE_LIMIT_MAX_REQUESTS),
    )
    monkeypatch.setattr(token_service, "monotonic", lambda: token_service.RATE_LIMIT_WINDOW_SECONDS - 1)

    response = client.get("/deepgram-token", headers={"x-forwarded-for": "203.0.113.9"})

    assert response.status_code == 429
    body = response.json()
    assert body["error"] == "Too many token requests."
