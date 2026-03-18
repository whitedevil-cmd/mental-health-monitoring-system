"""Supabase debug helpers for agent-driven verification."""

from __future__ import annotations

from backend.storage.data_backend import StorageBackend
from backend.utils.errors import DatabaseOperationError

_service = StorageBackend()


def get_table_data(table: str, limit: int = 5):
    try:
        return _service._select_rows_sync(table, limit, {}, {}, None, False)
    except DatabaseOperationError as exc:
        return {"error": exc.message, "details": exc.details, "table": table}
    except Exception as exc:  # pragma: no cover - debug safety net
        return {"error": str(exc), "table": table}


def insert_row(table: str, data: dict):
    try:
        payload = _service.prepare_insert_payload(table, data)
        return _service._insert_row_sync(table, payload)
    except DatabaseOperationError as exc:
        return {"error": exc.message, "details": exc.details, "table": table}
    except Exception as exc:  # pragma: no cover - debug safety net
        return {"error": str(exc), "table": table}


def debug_table_schema(table: str):
    try:
        sample = _service._select_rows_sync(table, 1, {}, {}, None, False)
        return {
            "status": "ok",
            "sample": sample,
        }
    except DatabaseOperationError as exc:
        return {"error": exc.message, "details": exc.details, "table": table}
    except Exception as exc:  # pragma: no cover - debug safety net
        return {"error": str(exc), "table": table}
