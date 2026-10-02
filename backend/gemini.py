import math
import os
import time
from functools import lru_cache
from typing import TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from observability import AppError, record_llm_call

MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
EMBED_DIM = 768
EMBED_BATCH = 100

T = TypeVar("T", bound=BaseModel)


class AIServiceError(AppError):
    status_code = 502
    detail = "The AI service didn't respond properly. Please try again in a moment."


def _ai_error(exc: Exception) -> AIServiceError:
    # A 429 that survived the retries is a spent quota (often the free tier's
    # daily cap), so say that instead of suggesting an immediate retry.
    if getattr(exc, "code", None) == 429:
        return AIServiceError("The AI usage limit has been reached. Please try again later.", status_code=429)
    return AIServiceError()


# Gemini returns 503 "high demand" in short bursts; retrying a couple of times
# with backoff hides most of them. 429 is left out: on the free tier it means a
# spent quota (often the daily cap), which seconds of waiting won't fix, so we
# fail fast. The timeout bounds each attempt, since interview requests hold a
# row lock while they wait.
RETRY = types.HttpRetryOptions(
    attempts=3, initial_delay=1.0, max_delay=8.0, http_status_codes=[408, 500, 502, 503, 504]
)
TIMEOUT_MS = 45_000


# Created on first use: genai.Client raises if the API key is missing,
# which would otherwise break importing the app (e.g. in tests).
@lru_cache(maxsize=1)
def _client() -> genai.Client:
    return genai.Client(
        api_key=os.getenv("GEMINI_API_KEY"),
        http_options=types.HttpOptions(retry_options=RETRY, timeout=TIMEOUT_MS),
    )


def _describe(exc: Exception) -> str:
    code = getattr(exc, "code", None)
    return f"{type(exc).__name__} {code}" if code else type(exc).__name__


def _generate(prompt: str, operation: str, config: types.GenerateContentConfig | None = None):
    """One tracked generate_content call. Raises AIServiceError on any failure."""
    start = time.perf_counter()
    try:
        response = _client().models.generate_content(model=MODEL, contents=prompt, config=config)
    except Exception as exc:
        record_llm_call(operation, MODEL, (time.perf_counter() - start) * 1000, ok=False, error=_describe(exc))
        raise _ai_error(exc) from exc

    usage = response.usage_metadata
    # Thinking tokens are billed as output, so count them with the answer.
    output = ((usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0)) if usage else 0
    record_llm_call(
        operation,
        MODEL,
        (time.perf_counter() - start) * 1000,
        prompt_tokens=(usage.prompt_token_count or 0) if usage else 0,
        output_tokens=output,
        total_tokens=(usage.total_token_count or 0) if usage else 0,
    )
    return response


def _thinking(budget: int | None) -> types.ThinkingConfig | None:
    # Only the 2.5 family takes a token budget; Pro can't switch thinking off entirely.
    if budget is None or not MODEL.startswith("gemini-2.5"):
        return None
    return types.ThinkingConfig(thinking_budget=max(budget, 128) if "pro" in MODEL else budget)


def generate_json(
    prompt: str,
    schema: type[T],
    *,
    operation: str,
    temperature: float = 0.4,
    thinking_budget: int | None = None,
) -> T:
    """
    Asks Gemini for JSON matching a Pydantic model and returns the parsed model.
    `thinking_budget` caps hidden reasoning tokens: unbounded thinking made
    interview planning take ~15s instead of ~5s, so callers set one per task.
    """
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature,
        thinking_config=_thinking(thinking_budget),
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    response = _generate(prompt, operation, config)

    if isinstance(response.parsed, schema):
        return response.parsed
    try:
        return schema.model_validate_json(response.text or "")
    except ValidationError as exc:
        raise AIServiceError() from exc


def embed_texts(texts: list[str], *, task_type: str = "RETRIEVAL_DOCUMENT") -> list[list[float]]:
    """Unit-length embeddings of EMBED_DIM floats, one per text."""
    vectors: list[list[float]] = []
    config = types.EmbedContentConfig(task_type=task_type, output_dimensionality=EMBED_DIM)

    for i in range(0, len(texts), EMBED_BATCH):
        batch = texts[i : i + EMBED_BATCH]
        start = time.perf_counter()
        try:
            response = _client().models.embed_content(model=EMBED_MODEL, contents=batch, config=config)
        except Exception as exc:
            record_llm_call("embedding", EMBED_MODEL, (time.perf_counter() - start) * 1000, ok=False, error=_describe(exc))
            raise _ai_error(exc) from exc
        # The embedding API doesn't report token counts.
        record_llm_call("embedding", EMBED_MODEL, (time.perf_counter() - start) * 1000)
        vectors.extend(_normalize(e.values or []) for e in response.embeddings or [])

    if len(vectors) != len(texts) or any(len(v) != EMBED_DIM for v in vectors):
        raise AIServiceError()
    return vectors


def _normalize(values: list[float]) -> list[float]:
    # Gemini only normalizes full-size embeddings; truncated ones need it done here.
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


def generate_questions(resume_text: str) -> str:
    prompt = f"""
You are a senior technical interviewer.

Analyze the resume below and generate interview questions in STRICT MARKDOWN FORMAT.

RULES:
- Use Markdown ONLY (no plain text)
- Group questions under clear sections
- Use headings (##, ###)
- Use bullet points
- Do NOT write explanations
- Do NOT add greetings or conclusions
- Do NOT use numbering outside markdown lists

FORMAT EXACTLY LIKE THIS:

## 🧠 Technical Questions
### 1. Topic Name
- Question 1
- Question 2

## 🤖 Machine Learning Questions
### 2. Topic Name
- Question 1
- Question 2

## 💬 Behavioral Questions
### 3. Topic Name
- Question 1
- Question 2

Resume:
{resume_text}
"""

    return _generate(prompt, "resume_questions").text
