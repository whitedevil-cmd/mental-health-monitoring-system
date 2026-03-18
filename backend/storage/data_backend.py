"""Supabase-backed storage with an in-memory fallback mode."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import logging
import os
from typing import Any, Literal

from backend.storage.client import get_supabase_client, has_supabase_config
from backend.utils.config import get_settings
from backend.utils.errors import DatabaseOperationError

logger = logging.getLogger(__name__)

BackendMode = Literal["supabase", "memory"]

TABLE_RULES: dict[str, dict[str, Any]] = {
    "users": {
        "required": {"id"},
        "allowed": {"id", "external_id", "created_at"},
        "defaults": {},
    },
    "audio_recordings": {
        "required": {"user_id", "file_path", "mime_type"},
        "allowed": {"id", "user_id", "file_path", "mime_type", "created_at"},
        "defaults": {},
    },
    "emotion_readings": {
        "required": {"user_id", "emotion_label"},
        "allowed": {"id", "user_id", "audio_id", "emotion_label", "confidence", "transcript", "created_at"},
        "defaults": {
            "audio_id": None,
            "confidence": None,
            "transcript": None,
        },
    },
    "conversation_memories": {
        "required": {"user_id", "detected_emotion", "ai_response"},
        "allowed": {"id", "user_id", "transcript", "detected_emotion", "ai_response", "created_at"},
        "defaults": {
            "transcript": None,
        },
    },
    "emotion_logs": {
        "required": {"user_id", "dominant_emotion"},
        "allowed": {
            "id",
            "user_id",
            "timestamp",
            "dominant_emotion",
            "sad_score",
            "happy_score",
            "angry_score",
            "neutral_score",
            "transcript",
        },
        "defaults": {
            "sad_score": 0.0,
            "happy_score": 0.0,
            "angry_score": 0.0,
            "neutral_score": 0.0,
            "transcript": None,
        },
    },
}

_FALLBACK_COUNTERS: dict[str, int] = defaultdict(int)
_FALLBACK_STORE: dict[str, list[dict[str, Any]]] = defaultdict(list)


class StorageBackend:
    """Thin async wrapper around Supabase REST with memory fallback."""

    async def select_rows(
        self,
        table: str,
        *,
        limit: int | None = None,
        eq_filters: dict[str, Any] | None = None,
        gte_filters: dict[str, Any] | None = None,
        order_by: str | None = None,
        desc: bool = False,
    ) -> list[dict[str, Any]]:
        return await asyncio.to_thread(
            self._select_rows_sync,
            table,
            limit,
            eq_filters or {},
            gte_filters or {},
            order_by,
            desc,
        )

    async def insert_row(self, table: str, data: dict[str, Any]) -> dict[str, Any]:
        payload = self.prepare_insert_payload(table, data)
        return await asyncio.to_thread(self._insert_row_sync, table, payload)

    async def verify_access(self, table: str) -> dict[str, Any]:
        try:
            rows = await self.select_rows(table, limit=1)
            return {
                "status": "ok",
                "table": table,
                "sample_count": len(rows),
                "mode": self._backend_mode(),
            }
        except Exception as exc:
            return {
                "status": "error",
                "table": table,
                "error": str(exc),
            }

    async def list_rows_since_days(
        self,
        table: str,
        *,
        user_id: str,
        days: int,
        order_by: str = "created_at",
    ) -> list[dict[str, Any]]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        return await self.select_rows(
            table,
            eq_filters={"user_id": user_id},
            gte_filters={order_by: cutoff.isoformat()},
            order_by=order_by,
        )

    def prepare_insert_payload(self, table: str, data: dict[str, Any]) -> dict[str, Any]:
        rules = TABLE_RULES.get(table)
        if rules is None:
            raise DatabaseOperationError(
                "Unsupported table.",
                details=f"No validation rules configured for table '{table}'.",
            )

        payload = {key: value for key, value in data.items() if key in rules["allowed"] and value is not None}
        missing = sorted(field for field in rules["required"] if payload.get(field) in (None, ""))
        if missing:
            raise DatabaseOperationError(
                "Invalid database payload.",
                details=f"Missing required fields for {table}: {', '.join(missing)}",
                status_code=400,
            )

        for key, value in rules["defaults"].items():
            payload.setdefault(key, value)
        return payload

    @classmethod
    def _backend_mode(cls) -> BackendMode:
        settings = get_settings()
        configured = (settings.DATA_BACKEND or "supabase").strip().lower()
        if configured == "memory":
            return "memory"
        if configured != "supabase":
            logger.warning("Unknown DATA_BACKEND=%s; defaulting to supabase", settings.DATA_BACKEND)

        if has_supabase_config():
            return "supabase"

        if settings.ENVIRONMENT != "production" or bool(os.getenv("PYTEST_CURRENT_TEST")):
            logger.warning("Supabase config missing; falling back to in-memory backend.")
            return "memory"

        return "supabase"

    @classmethod
    def _select_rows_sync(
        cls,
        table: str,
        limit: int | None,
        eq_filters: dict[str, Any],
        gte_filters: dict[str, Any],
        order_by: str | None,
        desc: bool,
    ) -> list[dict[str, Any]]:
        if cls._backend_mode() == "memory":
            return cls._memory_select_rows(table, limit, eq_filters, gte_filters, order_by, desc)

        try:
            client = get_supabase_client()
            query = client.table(table).select("*")
            for key, value in eq_filters.items():
                query = query.eq(key, value)
            for key, value in gte_filters.items():
                query = query.gte(key, value)
            if order_by:
                query = query.order(order_by, desc=desc)
            if limit is not None:
                query = query.limit(limit)
            result = query.execute()
            return list(result.data or [])
        except Exception as exc:
            logger.exception("Supabase select failed for table %s: %s", table, exc)
            raise DatabaseOperationError(
                "Failed to fetch database rows.",
                details=f"{table}: {exc}",
            ) from exc

    @classmethod
    def _insert_row_sync(cls, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        if cls._backend_mode() == "memory":
            return cls._memory_insert_row(table, payload)

        try:
            client = get_supabase_client()
            result = client.table(table).insert(payload).execute()
            rows = list(result.data or [])
            return rows[0] if rows else {}
        except Exception as exc:
            logger.exception("Supabase insert failed for table %s: %s", table, exc)
            raise DatabaseOperationError(
                "Failed to insert database row.",
                details=f"{table}: {exc}",
            ) from exc

    @staticmethod
    def _memory_insert_row(table: str, payload: dict[str, Any]) -> dict[str, Any]:
        row = dict(payload)
        _FALLBACK_COUNTERS[table] += 1
        row.setdefault("id", _FALLBACK_COUNTERS[table])
        now = datetime.now(timezone.utc)
        if table == "emotion_logs":
            row.setdefault("timestamp", now)
        else:
            row.setdefault("created_at", now)
        _FALLBACK_STORE[table].append(row)
        return dict(row)

    @staticmethod
    def _memory_select_rows(
        table: str,
        limit: int | None,
        eq_filters: dict[str, Any],
        gte_filters: dict[str, Any],
        order_by: str | None,
        desc: bool,
    ) -> list[dict[str, Any]]:
        rows = [dict(row) for row in _FALLBACK_STORE.get(table, [])]
        for key, value in eq_filters.items():
            rows = [row for row in rows if row.get(key) == value]
        for key, value in gte_filters.items():
            rows = [row for row in rows if row.get(key) is not None and str(row.get(key)) >= str(value)]
        if order_by:
            rows.sort(key=lambda row: row.get(order_by), reverse=desc)
        if limit is not None:
            rows = rows[:limit]
        return rows

