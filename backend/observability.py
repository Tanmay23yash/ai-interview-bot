"""
Request context, structured logging, API error handling and LLM usage tracking.

Every request gets a correlation ID (taken from the X-Correlation-ID header,
or generated) that is echoed back in the response and attached to every log
line. Interview endpoints also bind the interview session ID, so one grep
follows a whole interview across requests.
"""
import contextvars
import json
import logging
import os
import re
import sys
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.datastructures import MutableHeaders
from starlette.exceptions import HTTPException as StarletteHTTPException

CORRELATION_HEADER = "X-Correlation-ID"

correlation_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("correlation_id", default=None)
session_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("session_id", default=None)
_usage_var: contextvars.ContextVar["UsageTracker | None"] = contextvars.ContextVar("llm_usage", default=None)

logger = logging.getLogger("hiremind")

# Client-supplied IDs end up in logs, so only accept a short, plain token.
_SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_SESSION_PATH = re.compile(r"^/interviews/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")


# ---------------- ERRORS ----------------

class AppError(Exception):
    """An error with a status code and a message that is safe to show the user."""

    status_code = 500
    detail = "Something went wrong"

    def __init__(self, detail: str | None = None, status_code: int | None = None):
        super().__init__(detail or self.detail)
        if detail:
            self.detail = detail
        if status_code:
            self.status_code = status_code


def _error_body(detail) -> dict:
    return {"detail": detail, "correlation_id": correlation_id_var.get()}


def install_error_handlers(app: FastAPI) -> None:
    # Same {"detail": ...} shape FastAPI uses by default, plus the correlation ID.
    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        return JSONResponse(_error_body(exc.detail), status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        return JSONResponse(_error_body(jsonable_encoder(exc.errors())), status_code=422)

    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        level = logging.ERROR if exc.status_code >= 500 else logging.INFO
        logger.log(level, "app.error", extra={"error": type(exc).__name__, "status": exc.status_code, "detail": exc.detail})
        return JSONResponse(_error_body(exc.detail), status_code=exc.status_code)


# ---------------- LOGGING ----------------

_STANDARD_ATTRS = set(vars(logging.makeLogRecord({}))) | {"message", "asctime", "correlation_id", "session_id"}


class _ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id_var.get()
        record.session_id = session_id_var.get()
        return True


def _extras(record: logging.LogRecord) -> dict:
    return {k: v for k, v in vars(record).items() if k not in _STANDARD_ATTRS and not k.startswith("_")}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "event": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", None),
            "session_id": getattr(record, "session_id", None),
            **_extras(record),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class TextFormatter(logging.Formatter):
    """logfmt-style lines for reading in a terminal (LOG_FORMAT=text)."""

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created).strftime("%H:%M:%S.%f")[:-3]
        ids = f"cid={getattr(record, 'correlation_id', None) or '-'}"
        if getattr(record, "session_id", None):
            ids += f" sid={record.session_id}"
        fields = " ".join(f"{k}={v}" for k, v in _extras(record).items())
        line = f"{ts} {record.levelname:<5} {record.getMessage()} {ids} {fields}".rstrip()
        if record.exc_info:
            line += "\n" + self.formatException(record.exc_info)
        return line


def configure_logging() -> None:
    """JSON logs to stdout by default; LOG_FORMAT=text for a readable console."""
    root = logging.getLogger()
    if any(getattr(h, "_hiremind", False) for h in root.handlers):
        return

    handler = logging.StreamHandler(sys.stdout)
    handler._hiremind = True  # type: ignore[attr-defined]
    handler.addFilter(_ContextFilter())
    handler.setFormatter(TextFormatter() if os.getenv("LOG_FORMAT", "json").lower() == "text" else JsonFormatter())
    root.addHandler(handler)
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    # The google-genai client logs every HTTP call at INFO; we log our own summary instead.
    logging.getLogger("httpx").setLevel(logging.WARNING)


# ---------------- REQUEST CONTEXT ----------------

class RequestContextMiddleware:
    """
    Binds the correlation ID (and interview session ID, for /interviews/{id}
    routes) for the request, logs one line per request with its latency, and
    turns unexpected exceptions into a JSON 500 that still carries the ID.
    Pure ASGI so the context variables reach the endpoint unchanged.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        incoming = headers.get("x-correlation-id") or headers.get("x-request-id") or ""
        cid = incoming if _SAFE_ID.match(incoming) else uuid.uuid4().hex
        match = _SESSION_PATH.match(scope["path"])

        cid_token = correlation_id_var.set(cid)
        sid_token = session_id_var.set(match.group(1) if match else None)
        start = time.perf_counter()
        status = 500
        started = False

        async def send_with_headers(message):
            nonlocal status, started
            if message["type"] == "http.response.start":
                started = True
                status = message["status"]
                response_headers = MutableHeaders(scope=message)
                response_headers[CORRELATION_HEADER] = cid
                response_headers["X-Response-Time-ms"] = f"{(time.perf_counter() - start) * 1000:.1f}"
            await send(message)

        try:
            await self.app(scope, receive, send_with_headers)
        except Exception:
            logger.exception("http.unhandled_error", extra={"method": scope["method"], "path": scope["path"]})
            if started:
                raise
            response = JSONResponse(_error_body("Internal server error"), status_code=500)
            await response(scope, receive, send_with_headers)
        finally:
            logger.info(
                "http.request",
                extra={
                    "method": scope["method"],
                    "path": scope["path"],
                    "status": status,
                    "duration_ms": round((time.perf_counter() - start) * 1000, 1),
                },
            )
            session_id_var.reset(sid_token)
            correlation_id_var.reset(cid_token)


def bind_session(session_id: str) -> None:
    """Tags the rest of this request's logs with an interview session ID."""
    session_id_var.set(session_id)


# ---------------- LLM USAGE ----------------

@dataclass
class UsageTracker:
    """Token and latency totals for the LLM calls made inside track_usage()."""

    calls: int = 0
    failed_calls: int = 0
    prompt_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    by_operation: dict = field(default_factory=dict)

    def add(self, operation: str, latency_ms: float, prompt_tokens: int, output_tokens: int, total_tokens: int, ok: bool):
        self.calls += 1
        self.failed_calls += 0 if ok else 1
        self.prompt_tokens += prompt_tokens
        self.output_tokens += output_tokens
        self.total_tokens += total_tokens
        self.latency_ms += latency_ms
        op = self.by_operation.setdefault(operation, {"calls": 0, "total_tokens": 0, "latency_ms": 0.0})
        op["calls"] += 1
        op["total_tokens"] += total_tokens
        op["latency_ms"] = round(op["latency_ms"] + latency_ms, 1)

    def as_dict(self) -> dict:
        return {
            "calls": self.calls,
            "failed_calls": self.failed_calls,
            "prompt_tokens": self.prompt_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "latency_ms": round(self.latency_ms, 1),
            "by_operation": self.by_operation,
        }


def merge_usage(total: dict | None, new: dict) -> dict:
    """Adds one UsageTracker.as_dict() into a running total (as stored on a session row)."""
    merged = dict(total or {})
    for key in ("calls", "failed_calls", "prompt_tokens", "output_tokens", "total_tokens"):
        merged[key] = merged.get(key, 0) + new.get(key, 0)
    merged["latency_ms"] = round(merged.get("latency_ms", 0.0) + new.get("latency_ms", 0.0), 1)

    ops = {k: dict(v) for k, v in merged.get("by_operation", {}).items()}
    for name, op in new.get("by_operation", {}).items():
        current = ops.setdefault(name, {"calls": 0, "total_tokens": 0, "latency_ms": 0.0})
        current["calls"] += op["calls"]
        current["total_tokens"] += op["total_tokens"]
        current["latency_ms"] = round(current["latency_ms"] + op["latency_ms"], 1)
    merged["by_operation"] = ops
    return merged


@contextmanager
def track_usage():
    tracker = UsageTracker()
    token = _usage_var.set(tracker)
    try:
        yield tracker
    finally:
        _usage_var.reset(token)


def current_usage() -> UsageTracker | None:
    return _usage_var.get()


def record_llm_call(
    operation: str,
    model: str,
    latency_ms: float,
    *,
    prompt_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = 0,
    ok: bool = True,
    error: str | None = None,
) -> None:
    logger.log(
        logging.INFO if ok else logging.WARNING,
        "llm.call",
        extra={
            "operation": operation,
            "model": model,
            "latency_ms": round(latency_ms, 1),
            "prompt_tokens": prompt_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "ok": ok,
            **({"error": error} if error else {}),
        },
    )
    tracker = _usage_var.get()
    if tracker:
        tracker.add(operation, latency_ms, prompt_tokens, output_tokens, total_tokens, ok)
