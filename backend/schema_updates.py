"""Additive column changes for databases created before the column existed.

create_all() creates missing tables but never adds columns to existing ones,
and the project has no migration tool yet. New nullable columns are listed
here and added idempotently at startup, after create_all().
"""
import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger("hiremind.schema")

ADDED_COLUMNS = [
    ("users", "first_name", "VARCHAR(50)"),
]


def add_missing_columns(engine: Engine) -> None:
    with engine.begin() as conn:
        for table, column, ddl in ADDED_COLUMNS:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {ddl}"))
    logger.info("schema.columns_checked", extra={"columns": [f"{t}.{c}" for t, c, _ in ADDED_COLUMNS]})
