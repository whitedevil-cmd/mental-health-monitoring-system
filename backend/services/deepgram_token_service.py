"""Issue short-lived Deepgram access tokens for browser clients."""

from __future__ import annotations

from collections import deque
from threading import Lock
from time import monotonic

import httpx

from backend.utils.config import get_settings
from backend.utils.errors import ServiceError

DEEPGRAM_GRANT_URL = "https://api.deepgram.com/v1/auth/grant"
DEFAULT_TTL_SECONDS = 90
RATE_LIMIT_WINDOW_SECONDS = 60.0
RATE_LIMIT_MAX_REQUESTS = 10
DEEPGRAM_TIMEOUT_SECONDS = 5.0

_token_request_history: dict[str, deque[float]] = {}
_token_rate_limit_lock = Lock()


def extract_client_identifier(forwarded_for: str | None, client_host: str | None) -> str:
    """Return the best-effort client identifier for rate limiting."""
    if forwarded_for:
        first_hop = forwarded_for.split(",")[0].strip()
        if first_hop:
            return first_hop
    return client_host or "unknown"


def enforce_token_rate_limit(client_id: str) -> None:
    """Apply a simple in-memory per-client token grant rate limit."""
    now = monotonic()
    with _token_rate_limit_lock:
        history = _token_request_history.setdefault(client_id, deque())
        cutoff = now - RATE_LIMIT_WINDOW_SECONDS
        while history and history[0] < cutoff:
            history.popleft()

        if len(history) >= RATE_LIMIT_MAX_REQUESTS:
            raise ServiceError(
                "Too many token requests.",
                details="Please wait before requesting another Deepgram token.",
                status_code=429,
            )

        history.append(now)


def _parse_error_details(payload: object, default: str) -> str:
    """Return the best available error message from a Deepgram response payload."""
    if isinstance(payload, dict):
        detail = payload.get("err_msg") or payload.get("error") or payload.get("message")
        if detail:
            return str(detail)
    return default


async def issue_deepgram_token(ttl_seconds: int = DEFAULT_TTL_SECONDS) -> dict[str, object]:
    """Return a short-lived Deepgram access token using a native async HTTP client."""
    settings = get_settings()
    if not settings.DEEPGRAM_API_KEY:
        raise ServiceError(
            "Deepgram configuration missing.",
            details="DEEPGRAM_API_KEY is not set.",
            status_code=500,
        )

    timeout = httpx.Timeout(DEEPGRAM_TIMEOUT_SECONDS, connect=DEEPGRAM_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(
                DEEPGRAM_GRANT_URL,
                json={"ttl_seconds": ttl_seconds},
                headers={
                    "Authorization": f"Token {settings.DEEPGRAM_API_KEY}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
        except httpx.TimeoutException as exc:
            raise ServiceError(
                "Deepgram token request failed.",
                details="Deepgram token request timed out.",
                status_code=502,
            ) from exc
        except httpx.RequestError as exc:
            raise ServiceError(
                "Deepgram token request failed.",
                details="Unable to reach Deepgram.",
                status_code=502,
            ) from exc

    try:
        parsed = response.json()
    except ValueError as exc:
        raise ServiceError(
            "Deepgram token request failed.",
            details="Deepgram returned an invalid token response.",
            status_code=502,
        ) from exc

    if response.status_code >= 400:
        raise ServiceError(
            "Deepgram token request failed.",
            details=_parse_error_details(parsed, "Deepgram rejected the token grant request."),
            status_code=502,
        )

    token = str(parsed.get("access_token") or "").strip()
    expires_in = int(parsed.get("expires_in") or ttl_seconds)
    if not token:
        raise ServiceError(
            "Deepgram token request failed.",
            details="Deepgram returned an empty access token.",
            status_code=502,
        )

    return {"token": token, "expires_in": expires_in}
