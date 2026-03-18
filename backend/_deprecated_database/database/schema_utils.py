"""Lightweight runtime schema helpers for SQLite compatibility upgrades."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


async def ensure_sqlite_column(
    session: AsyncSession,
    *,
    table_name: str,
    column_name: str,
    column_definition: str,
) -> None:
    """Ensure a column exists for SQLite tables without requiring migrations."""
    conn = await session.connection()
    if conn.dialect.name != "sqlite":
        return

    result = await conn.exec_driver_sql(f"PRAGMA table_info({table_name})")
    columns = {str(row[1]) for row in result.fetchall()}
    if column_name not in columns:
        await conn.exec_driver_sql(
            f"ALTER TABLE {table_name} ADD COLUMN {column_definition}"
        )

