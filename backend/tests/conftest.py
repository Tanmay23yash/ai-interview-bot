import hashlib
import math
import re
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import gemini
import models
from auth import create_access_token
from database import SessionLocal
from main import app

SAMPLE_RESUME = """Jane Doe
jane@example.com | github.com/jane
SUMMARY
Backend engineer with 4 years building Python services.
EXPERIENCE
Acme Corp - Senior Backend Engineer (2021 - 2024)
Built a payments API in FastAPI and PostgreSQL handling 2M requests per day.
Introduced Redis caching that cut p95 latency by 40%.
Deployed services on Kubernetes with Helm and GitHub Actions.
PROJECTS
Interview Bot: React front end, FastAPI backend, Gemini question generation.
SKILLS
Python, FastAPI, PostgreSQL, Redis, Docker, Kubernetes, React, TypeScript
EDUCATION
B.Tech Computer Science, 2020
"""


def fake_embedding(text: str) -> list[float]:
    """Hashed bag of words: texts sharing words get similar vectors, like a (very) small real model."""
    vector = [0.0] * gemini.EMBED_DIM
    for word in re.findall(r"[a-z0-9]+", text.lower()):
        vector[int(hashlib.md5(word.encode()).hexdigest(), 16) % gemini.EMBED_DIM] += 1.0
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def fake_embeddings(monkeypatch):
    calls = []

    def embed(texts, task_type="RETRIEVAL_DOCUMENT"):
        calls.append((task_type, len(texts)))
        return [fake_embedding(t) for t in texts]

    monkeypatch.setattr(gemini, "embed_texts", embed)
    return calls


@pytest.fixture
def no_embeddings(monkeypatch):
    def embed(texts, task_type="RETRIEVAL_DOCUMENT"):
        raise gemini.AIServiceError()

    monkeypatch.setattr(gemini, "embed_texts", embed)


def default_gap_analysis(prompt: str) -> dict:
    return {
        "role_title": "Backend Engineer",
        "seniority": "Senior",
        "requirements": [
            {"skill": "Python", "category": "language", "importance": "must_have", "candidate_level": "strong", "evidence": "4 years of Python"},
            {"skill": "Kubernetes", "category": "cloud_devops", "importance": "Must-have", "candidate_level": "partial", "evidence": "Deployed with Helm"},
            {"skill": "Go", "category": "language", "importance": "required", "candidate_level": "missing", "evidence": "Not mentioned"},
            {"skill": "GraphQL", "category": "framework", "importance": "nice_to_have", "candidate_level": "missing", "evidence": "REST only"},
            {"skill": "Redis", "category": "database", "importance": "preferred", "candidate_level": "Strong", "evidence": "Caching cut p95 by 40%"},
        ],
        "extra_strengths": ["React"],
        "focus_topics": ["Go concurrency", "Kubernetes operations"],
        "summary": "Solid Python backend engineer; Go is the main gap.",
    }


def default_plan(prompt: str) -> dict:
    return {
        "candidate_summary": "Backend engineer with four years of Python services.",
        "topics": [
            {"topic": "Acme payments API", "skill": "API design", "category": "project_deep_dive", "priority": 1, "source": "resume", "rationale": "Biggest project"},
            {"topic": "Kubernetes deployments", "skill": "Kubernetes", "category": "Technical", "priority": 1, "source": "gap", "rationale": "Partial evidence"},
            {"topic": "Redis caching", "skill": "Caching", "category": "technical", "priority": 2, "source": "resume", "rationale": "Claimed 40% win"},
            {"topic": "acme payments api", "skill": "dup", "category": "technical", "priority": 1, "source": "resume", "rationale": "Duplicate"},
            {"topic": "Handling a disagreement", "skill": "Collaboration", "category": "behavioral", "priority": 3, "source": "resume", "rationale": "Soft skills"},
        ],
    }


def default_question(prompt: str) -> dict:
    topic = re.search(r"^Topic: (.+)$", prompt, re.M).group(1)
    level = re.search(r"^Difficulty: level (\d)", prompt, re.M).group(1)
    return {
        "question": f"[L{level}] Walk me through {topic}.",
        "question_type": "Project deep dive",
        "expected_points": ["Context", "Trade-offs", "Results", ""],
        "rationale": f"Checks depth on {topic}",
    }


def default_evaluation(prompt: str) -> dict:
    """Scores every dimension with the number the answer starts with, e.g. "8: ..." -> 8."""
    answer = re.search(r"<answer>\n(.*?)\n</answer>", prompt, re.S).group(1)
    number = re.match(r"\s*(\d+(?:\.\d+)?)", answer)
    score = float(number.group(1)) if number else 6.0
    return {
        "technical_accuracy": score, "relevance": score, "depth": score, "clarity": score, "completeness": score,
        "feedback": "You covered the basics.",
        "strengths": ["Clear structure"],
        "improvements": ["Quantify impact"],
        "missed_points": ["Trade-offs"],
        "weak_topics": [],
    }


BRANCH_LINE = re.compile(r'^([A-Z])\) overall (.+?) -> (new topic|follow-up on) "(.+?)".* at level (\d)/5', re.M)


def branches(prompt: str) -> dict[str, dict]:
    """The next-question branches listed in an evaluate_and_next prompt, by letter."""
    return {
        m.group(1): {
            "ranges": [(float(lo), float(hi)) for lo, hi in re.findall(r"(\d+\.\d) to (\d+\.\d)", m.group(2))],
            "follow_up": m.group(3) == "follow-up on",
            "topic": m.group(4),
            "level": int(m.group(5)),
        }
        for m in BRANCH_LINE.finditer(prompt)
    }


def default_evaluate_and_next(prompt: str) -> dict:
    """Grades like default_evaluation, then picks the branch for that score, as a well-behaved model would."""
    evaluation = default_evaluation(prompt)
    score = evaluation["technical_accuracy"]  # every dimension is equal, so this is also the overall
    label, branch = next((k, b) for k, b in branches(prompt).items() if any(lo <= score <= hi for lo, hi in b["ranges"]))
    return {
        **evaluation,
        "overall_estimate": score,
        "chosen_branch": label,
        "next_question": {
            "question": f"[L{branch['level']}] {'Going deeper on' if branch['follow_up'] else 'Walk me through'} {branch['topic']}.",
            "question_type": "scenario",
            "expected_points": ["Context", "Trade-offs", "Results"],
            "rationale": f"Drafted for branch {label}",
        },
    }


def default_report(prompt: str) -> dict:
    return {
        "summary": "Good foundation; deepen system design.",
        "strengths": ["Payments domain knowledge"],
        "weaknesses": ["Kubernetes internals"],
        "recommendations": [{"area": "Kubernetes", "why": "Scored low", "actions": ["Read the scheduler docs", "Deploy a toy cluster"]}],
    }


class FakeLLM:
    """
    Stands in for the Gemini client, so gemini.generate_json's parsing and
    token tracking run for real. Handlers are keyed by operation, take the
    prompt and return a dict; raising makes the call fail.
    """

    operations = {
        "GapAnalysisDraft": "gap_analysis",
        "InterviewPlanDraft": "interview_plan",
        "GeneratedQuestion": "question_generation",
        "AnswerEvaluationDraft": "answer_evaluation",
        "EvaluationWithNext": "evaluate_and_next",
        "ReportNarrative": "report_narrative",
    }
    defaults = {
        "gap_analysis": default_gap_analysis,
        "interview_plan": default_plan,
        "question_generation": default_question,
        "answer_evaluation": default_evaluation,
        "evaluate_and_next": default_evaluate_and_next,
        "report_narrative": default_report,
    }

    def __init__(self):
        self.calls: list[SimpleNamespace] = []
        self.handlers: dict = {}
        self.models = self

    def generate_content(self, model, contents, config):
        schema = config.response_schema
        operation = self.operations[schema.__name__]
        self.calls.append(SimpleNamespace(operation=operation, prompt=contents))
        parsed = schema.model_validate((self.handlers.get(operation) or self.defaults[operation])(contents))
        usage = SimpleNamespace(prompt_token_count=100, candidates_token_count=30, thoughts_token_count=10, total_token_count=140)
        return SimpleNamespace(parsed=parsed, text=parsed.model_dump_json(), usage_metadata=usage)

    def count(self, operation: str) -> int:
        return sum(c.operation == operation for c in self.calls)

    def prompts(self, operation: str) -> list[str]:
        return [c.prompt for c in self.calls if c.operation == operation]


@pytest.fixture
def fake_llm(monkeypatch):
    llm = FakeLLM()
    monkeypatch.setattr(gemini, "_client", lambda: llm)
    return llm


def _make_account(db) -> SimpleNamespace:
    user = models.User(email=f"agent_{uuid4().hex}@example.com", hashed_password="unused")
    db.add(user)
    db.commit()
    resume = models.Resume(filename="jane.pdf", extracted_text=SAMPLE_RESUME, questions="", user_id=user.id)
    db.add(resume)
    db.commit()
    token = create_access_token({"sub": user.email})
    return SimpleNamespace(user_id=user.id, resume_id=resume.id, headers={"Authorization": f"Bearer {token}"})


@pytest.fixture
def account_factory():
    """Users with one sample resume each; everything they own is deleted afterwards."""
    db = SessionLocal()
    made = []

    def make():
        made.append(_make_account(db))
        return made[-1]

    yield make

    for acc in made:
        # resumes.user_id predates ON DELETE CASCADE in some databases, so delete resumes first.
        db.query(models.Resume).filter(models.Resume.user_id == acc.user_id).delete()
        db.query(models.User).filter(models.User.id == acc.user_id).delete()
    db.commit()
    db.close()


@pytest.fixture
def account(account_factory):
    return account_factory()
