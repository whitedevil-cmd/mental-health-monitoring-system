"""Reliability tests for the Deepgram token service."""

from __future__ import annotations

import httpx
import pytest

from backend.services import deepgram_token_service as token_service
from backend.utils.errors import ServiceError


class _FakeAsyncClient:
    def __init__(self, *args, response: httpx.Response | None = None, error: Exception | None = None, calls=None, **kwargs):
        self._response = response
        self._error = error
        self._calls = calls if calls is not None else []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, json=None, headers=None):  # noqa: ANN001
        self._calls.append({"url": url, "json": json, "headers": headers})
        if self._error is not None:
            raise self._error
        if self._response is None:
            raise AssertionError("Fake client requires either a response or an error.")
        return self._response


@pytest.mark.asyncio
async def test_issue_deepgram_token_success(monkeypatch) -> None:
    calls: list[dict[str, object]] = []
    response = httpx.Response(200, json={"access_token": "temporary-token", "expires_in": 90})

    monkeypatch.setenv("DEEPGRAM_API_KEY", "deepgram-test-key")
    token_service.get_settings.cache_clear()
    monkeypatch.setattr(
        token_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(*args, response=response, calls=calls, **kwargs),
    )

    payload = await token_service.issue_deepgram_token()

    assert payload == {"token": "temporary-token", "expires_in": 90}
    assert len(calls) == 1
    assert calls[0]["url"] == token_service.DEEPGRAM_GRANT_URL
    assert calls[0]["json"] == {"ttl_seconds": token_service.DEFAULT_TTL_SECONDS}


@pytest.mark.asyncio
async def test_issue_deepgram_token_invalid_api_key(monkeypatch) -> None:
    response = httpx.Response(401, json={"err_msg": "Invalid credentials"})

    monkeypatch.setenv("DEEPGRAM_API_KEY", "bad-key")
    token_service.get_settings.cache_clear()
    monkeypatch.setattr(
        token_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(*args, response=response, **kwargs),
    )

    with pytest.raises(ServiceError) as exc_info:
        await token_service.issue_deepgram_token()

    assert exc_info.value.status_code == 502
    assert exc_info.value.details == "Invalid credentials"


@pytest.mark.asyncio
async def test_issue_deepgram_token_when_deepgram_unreachable(monkeypatch) -> None:
    request = httpx.Request("POST", token_service.DEEPGRAM_GRANT_URL)
    error = httpx.ConnectError("network down", request=request)

    monkeypatch.setenv("DEEPGRAM_API_KEY", "deepgram-test-key")
    token_service.get_settings.cache_clear()
    monkeypatch.setattr(
        token_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(*args, error=error, **kwargs),
    )

    with pytest.raises(ServiceError) as exc_info:
        await token_service.issue_deepgram_token()

    assert exc_info.value.status_code == 502
    assert exc_info.value.details == "Unable to reach Deepgram."


@pytest.mark.asyncio
async def test_issue_deepgram_token_times_out(monkeypatch) -> None:
    request = httpx.Request("POST", token_service.DEEPGRAM_GRANT_URL)
    error = httpx.ReadTimeout("slow upstream", request=request)

    monkeypatch.setenv("DEEPGRAM_API_KEY", "deepgram-test-key")
    token_service.get_settings.cache_clear()
    monkeypatch.setattr(
        token_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(*args, error=error, **kwargs),
    )

    with pytest.raises(ServiceError) as exc_info:
        await token_service.issue_deepgram_token()

    assert exc_info.value.status_code == 502
    assert exc_info.value.details == "Deepgram token request timed out."


@pytest.mark.asyncio
async def test_issue_deepgram_token_handles_multiple_sequential_requests(monkeypatch) -> None:
    calls: list[dict[str, object]] = []
    response = httpx.Response(200, json={"access_token": "temporary-token", "expires_in": 90})

    monkeypatch.setenv("DEEPGRAM_API_KEY", "deepgram-test-key")
    token_service.get_settings.cache_clear()
    monkeypatch.setattr(
        token_service.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(*args, response=response, calls=calls, **kwargs),
    )

    for _ in range(5):
        payload = await token_service.issue_deepgram_token()
        assert payload == {"token": "temporary-token", "expires_in": 90}

    assert len(calls) == 5
