from types import SimpleNamespace

import pytest
from pydantic import BaseModel

import gemini
from observability import track_usage


class Answer(BaseModel):
    value: int


class FakeModels:
    def __init__(self, response=None, embeddings=None):
        self.response = response
        self.embeddings = embeddings
        self.batches = []

    def generate_content(self, model, contents, config):
        return self.response

    def embed_content(self, model, contents, config):
        self.batches.append(len(contents))
        assert config.output_dimensionality == gemini.EMBED_DIM
        return SimpleNamespace(embeddings=[SimpleNamespace(values=v) for v in self.embeddings[: len(contents)]])


def _use(monkeypatch, models):
    monkeypatch.setattr(gemini, "_client", lambda: SimpleNamespace(models=models))


def test_generate_json_parses_text_when_sdk_did_not(monkeypatch):
    _use(monkeypatch, FakeModels(SimpleNamespace(parsed=None, text='{"value": 7}', usage_metadata=None)))
    with track_usage() as usage:
        assert gemini.generate_json("p", Answer, operation="t").value == 7
    assert usage.calls == 1 and usage.total_tokens == 0


def test_generate_json_rejects_malformed_output(monkeypatch):
    _use(monkeypatch, FakeModels(SimpleNamespace(parsed=None, text="not json", usage_metadata=None)))
    with pytest.raises(gemini.AIServiceError):
        gemini.generate_json("p", Answer, operation="t")


def test_failures_are_logged_with_their_status_code(monkeypatch, caplog):
    class Overloaded(Exception):
        code = 503

    class Models:
        def generate_content(self, model, contents, config):
            raise Overloaded("high demand")

    _use(monkeypatch, Models())
    with pytest.raises(gemini.AIServiceError):
        gemini.generate_json("p", Answer, operation="t")
    assert [r.error for r in caplog.records if r.getMessage() == "llm.call"] == ["Overloaded 503"]


def test_spent_quota_is_reported_as_429(monkeypatch):
    class QuotaExhausted(Exception):
        code = 429

    class Models:
        def generate_content(self, model, contents, config):
            raise QuotaExhausted("RESOURCE_EXHAUSTED")

    _use(monkeypatch, Models())
    with pytest.raises(gemini.AIServiceError) as caught:
        gemini.generate_json("p", Answer, operation="t")
    assert caught.value.status_code == 429 and "usage limit" in caught.value.detail


def test_client_retries_transient_errors_but_not_spent_quota():
    assert gemini.RETRY.attempts == 3 and gemini.TIMEOUT_MS == 45_000
    assert 503 in gemini.RETRY.http_status_codes
    assert 429 not in gemini.RETRY.http_status_codes


def test_thinking_budget_only_applies_to_models_that_take_one(monkeypatch):
    monkeypatch.setattr(gemini, "MODEL", "gemini-2.5-flash")
    assert gemini._thinking(0).thinking_budget == 0
    assert gemini._thinking(None) is None
    monkeypatch.setattr(gemini, "MODEL", "gemini-2.5-pro")
    assert gemini._thinking(0).thinking_budget == 128
    monkeypatch.setattr(gemini, "MODEL", "gemini-3-pro")
    assert gemini._thinking(512) is None


def test_embeddings_are_normalized_and_batched(monkeypatch):
    raw = [[3.0, 4.0] + [0.0] * (gemini.EMBED_DIM - 2)] * 150
    models = FakeModels(embeddings=raw)
    _use(monkeypatch, models)

    vectors = gemini.embed_texts(["text"] * 150)
    assert models.batches == [100, 50]
    assert vectors[0][:2] == [0.6, 0.8]


def test_embeddings_with_wrong_size_are_rejected(monkeypatch):
    _use(monkeypatch, FakeModels(embeddings=[[1.0, 2.0]]))
    with pytest.raises(gemini.AIServiceError):
        gemini.embed_texts(["text"])
