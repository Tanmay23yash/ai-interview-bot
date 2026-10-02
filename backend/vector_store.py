"""
Embedding storage for resume chunks.

With the pgvector extension, embeddings live in a vector(768) column and
similarity runs in Postgres (`<=>`, cosine distance). Without it, they are
stored as real[] and compared in Python, so the app still works on a plain
Postgres install. Once pgvector is installed, the next startup converts the
column in place.

VECTOR_BACKEND=auto (default) | pgvector (fail if missing) | array (never use it).
"""
import logging
import math
import os

from sqlalchemy import Engine, text
from sqlalchemy.dialects.postgresql import ARRAY, REAL
from sqlalchemy.types import TypeDecorator

from gemini import EMBED_DIM

logger = logging.getLogger("hiremind.vectors")

TABLE = "resume_chunks"
COLUMN = "embedding"

_pgvector = False


def pgvector_enabled() -> bool:
    return _pgvector


class Embedding(TypeDecorator):
    """A list[float] stored as vector(EMBED_DIM) when pgvector is on, else real[]."""

    impl = ARRAY(REAL)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if _pgvector:
            from pgvector.sqlalchemy import Vector

            return dialect.type_descriptor(Vector(EMBED_DIM))
        return dialect.type_descriptor(ARRAY(REAL))

    def process_result_value(self, value, dialect):
        return None if value is None else [float(v) for v in value]


def init_vector_store(engine: Engine) -> bool:
    """Decides the storage backend. Must run before create_all and before any query."""
    global _pgvector
    mode = os.getenv("VECTOR_BACKEND", "auto").lower()

    available = mode != "array" and _create_extension(engine)
    if mode == "pgvector" and not available:
        raise RuntimeError("VECTOR_BACKEND=pgvector, but the pgvector extension is not installed on this Postgres server")

    column = _column_type(engine)
    if column == "_float4" and available:
        with engine.begin() as conn:
            conn.execute(
                text(f"ALTER TABLE {TABLE} ALTER COLUMN {COLUMN} TYPE vector({EMBED_DIM}) USING {COLUMN}::vector({EMBED_DIM})")
            )
        logger.info("vector_store.column_upgraded", extra={"table": TABLE, "to": f"vector({EMBED_DIM})"})
        column = "vector"

    # An existing vector column has to be used as one, whatever the mode says.
    _pgvector = column == "vector" or (column is None and available)
    logger.info("vector_store.ready", extra={"backend": "pgvector" if _pgvector else "array", "mode": mode})
    return _pgvector


def _create_extension(engine: Engine) -> bool:
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        return True
    except Exception as exc:
        reason = str(getattr(exc, "orig", exc)).strip().splitlines()[0]
        logger.warning("vector_store.pgvector_unavailable", extra={"reason": reason, "fallback": "real[] + in-app cosine"})
        return False


def _column_type(engine: Engine) -> str | None:
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT udt_name FROM information_schema.columns WHERE table_name = :t AND column_name = :c"),
            {"t": TABLE, "c": COLUMN},
        ).scalar()


def to_pgvector(values: list[float]) -> str:
    return "[" + ",".join(f"{v:.7g}" for v in values) + "]"


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0
