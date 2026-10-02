import logging

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from main import app
from observability import (
    AppError,
    RequestContextMiddleware,
    correlation_id_var,
    install_error_handlers,
    merge_usage,
    record_llm_call,
    track_usage,
)

client = TestClient(app)


def _mini_app() -> TestClient:
    mini = FastAPI()
    install_error_handlers(mini)
    mini.add_middleware(RequestContextMiddleware)

    @mini.get("/boom")
    def boom():
        raise RuntimeError("kaboom")

    @mini.get("/app-error")
    def app_error():
        raise AppError("Nope", status_code=409)

    @mini.get("/cid")
    def cid():
        return {"cid": correlation_id_var.get()}

    return TestClient(mini, raise_server_exceptions=False)


def test_correlation_id_is_generated_and_echoed():
    response = client.get("/")
    assert len(response.headers["X-Correlation-ID"]) == 32
    assert "X-Response-Time-ms" in response.headers


def test_incoming_correlation_id_is_reused_and_visible_to_endpoints():
    mini = _mini_app()
    response = mini.get("/cid", headers={"X-Correlation-ID": "trace-abc_123"})
    assert response.headers["X-Correlation-ID"] == "trace-abc_123"
    assert response.json() == {"cid": "trace-abc_123"}


def test_unsafe_correlation_id_is_replaced():
    response = client.get("/", headers={"X-Correlation-ID": "bad id\nwith newline"})
    assert response.headers["X-Correlation-ID"] != "bad id\nwith newline"


def test_http_errors_keep_detail_and_add_correlation_id():
    response = client.get("/resumes", headers={"X-Correlation-ID": "abc"})
    assert response.status_code == 401
    assert response.json() == {"detail": response.json()["detail"], "correlation_id": "abc"}


def test_validation_errors_carry_correlation_id():
    response = client.post("/auth/login", json={"email": "not-an-email"})
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)
    assert response.json()["correlation_id"] == response.headers["X-Correlation-ID"]


def test_unhandled_exception_becomes_json_500():
    mini = _mini_app()
    response = mini.get("/boom", headers={"X-Correlation-ID": "boom-1"})
    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error", "correlation_id": "boom-1"}


def test_app_error_uses_its_status_and_message():
    response = _mini_app().get("/app-error")
    assert response.status_code == 409
    assert response.json()["detail"] == "Nope"


def test_usage_tracking_and_merge(caplog):
    with caplog.at_level(logging.INFO, logger="hiremind"):
        with track_usage() as usage:
            record_llm_call("question_generation", "m", 120.0, prompt_tokens=100, output_tokens=40, total_tokens=140)
            record_llm_call("answer_evaluation", "m", 80.0, ok=False, error="Timeout")

    assert usage.calls == 2 and usage.failed_calls == 1
    assert usage.total_tokens == 140
    assert [r.operation for r in caplog.records if r.getMessage() == "llm.call"] == [
        "question_generation",
        "answer_evaluation",
    ]

    merged = merge_usage(merge_usage(None, usage.as_dict()), usage.as_dict())
    assert merged["calls"] == 4
    assert merged["by_operation"]["question_generation"] == {"calls": 2, "total_tokens": 280, "latency_ms": 240.0}

    # Outside track_usage() nothing is accumulated, but nothing breaks either.
    record_llm_call("x", "m", 1.0)
