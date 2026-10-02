"""
The interview orchestrator: the one place that coordinates the agents.

  start   index resume (RAG) -> gap analysis (with a job) -> plan topics -> first question
  answer  reuse the question's context -> grade it and draft the next question (one LLM call)
          -> adjust difficulty -> note new weak topics -> keep the draft if the policies agree
  next    the drafted question, or: choose topic -> retrieve resume context -> generate question
  finish  analytics -> AI debrief -> report

Every step is timed and token-counted into the turn's `trace`, and all LLM
usage is added to the session's running totals. Callers pass a session row
locked with SELECT ... FOR UPDATE, so concurrent requests for one interview
run one at a time.
"""
import logging
import time
from contextlib import contextmanager
from datetime import datetime

from sqlalchemy.orm import Session

import models
import rag
import skill_gap
from interview import agents
from interview.policy import (
    DifficultyDecision,
    TopicChoice,
    TurnSummary,
    add_weak_topic,
    choose_next_topic,
    next_difficulty,
    next_question_options,
)
from interview.report import build_report
from observability import AppError, bind_session, current_usage, merge_usage, track_usage

logger = logging.getLogger("hiremind.orchestrator")


class Trace:
    """Timed, token-counted agent steps for one turn."""

    def __init__(self):
        self.steps: list[dict] = []

    @contextmanager
    def step(self, agent: str):
        detail: dict = {}
        usage = current_usage()
        tokens_before = usage.total_tokens if usage else 0
        start = time.perf_counter()
        ok = False
        try:
            yield detail
            ok = True
        finally:
            duration = round((time.perf_counter() - start) * 1000, 1)
            tokens = (usage.total_tokens - tokens_before) if usage else 0
            self.steps.append({"agent": agent, "duration_ms": duration, "tokens": tokens, **detail})
            logger.info("agent.step", extra={"agent": agent, "duration_ms": duration, "tokens": tokens, "ok": ok})


class InterviewOrchestrator:
    def __init__(self, db: Session):
        self.db = db

    # ---------------- public ----------------

    def start(
        self,
        user: models.User,
        resume: models.Resume,
        job: models.JobDescription | None,
        max_questions: int,
        difficulty: int,
    ) -> models.InterviewSession:
        trace = Trace()
        with track_usage() as usage:
            with trace.step("resume_indexer") as step:
                step.update(rag.ensure_indexed(self.db, resume))

            gap = None
            if job:
                with trace.step("gap_analyzer") as step:
                    gap = skill_gap.get_or_create_analysis(self.db, resume, job).result
                    step["match_score"] = gap["match_score"]

            with trace.step("planner") as step:
                plan = agents.plan_interview(resume.extracted_text or "", gap, max_questions)
                step["topics"] = [t["topic"] for t in plan["topics"]]

            session = models.InterviewSession(
                user_id=user.id,
                resume_id=resume.id,
                job_description_id=job.id if job else None,
                title=f"{job.title} · {resume.filename}" if job else resume.filename,
                status="active",
                max_questions=max_questions,
                difficulty=difficulty,
                plan=plan,
                usage={},
            )
            self.db.add(session)
            self.db.flush()
            bind_session(session.id)
            logger.info(
                "interview.started",
                extra={"resume_id": resume.id, "job_id": session.job_description_id, "max_questions": max_questions, "difficulty": difficulty},
            )
            self._ask_next(session, trace)

        session.usage = merge_usage(None, usage.as_dict())
        self.db.commit()
        return session

    def next_question(self, session: models.InterviewSession) -> models.InterviewTurn:
        """The open question, generating a new one if the last was answered. Safe to call repeatedly."""
        pending = self._pending(session)
        if pending:
            return pending
        self._require_active(session)
        if len(session.turns) >= session.max_questions:
            raise AppError("All questions have been asked. Finish the interview to see your report.", 409)

        with track_usage() as usage:
            turn = self._ask_next(session, Trace())
        session.usage = merge_usage(session.usage, usage.as_dict())
        self.db.commit()
        return turn

    def submit_answer(
        self, session: models.InterviewSession, answer: str, skipped: bool
    ) -> tuple[models.InterviewTurn, DifficultyDecision, bool]:
        """Grades the open question. Returns (turn, difficulty decision, whether the question budget is used up)."""
        self._require_active(session)
        turn = self._pending(session)
        if not turn:
            raise AppError("There's no open question to answer.", 409)

        trace = Trace()
        draft = None
        with track_usage() as usage:
            if skipped:
                evaluation = agents.skipped_evaluation(self._turn_dict(turn))
            else:
                with trace.step("resume_retriever") as step:
                    chunks = self._context_for(turn)
                    step.update(method="reused", chunk_ids=[c.id for c in chunks])
                if len(session.turns) < session.max_questions:
                    evaluation, draft = self._grade_and_draft_next(session, turn, answer, chunks, trace)
                else:
                    with trace.step("answer_evaluator") as step:
                        evaluation = agents.evaluate_answer(self._turn_dict(turn), answer, chunks)
                        step["score"] = evaluation["overall"]

            turn.answer = None if skipped else answer
            turn.skipped = skipped
            turn.evaluation = evaluation
            turn.score = evaluation["overall"]
            turn.answered_at = datetime.utcnow()

            with trace.step("difficulty_controller") as step:
                decision = next_difficulty(session.difficulty, self._history(session))
                step.update(decision.as_dict())
            session.difficulty = decision.level

            with trace.step("plan_updater") as step:
                topics, added = add_weak_topic(session.plan["topics"], evaluation["weak_topics"], self._turn_dict(turn))
                if added:
                    session.plan = {**session.plan, "topics": topics}
                step["added_topic"] = added["topic"] if added else None

            complete = len(session.turns) >= session.max_questions
            if draft:
                with trace.step("draft_checker") as step:
                    step.update(self._keep_draft_if_chosen(session, decision, draft))

        turn.trace = [*turn.trace, *trace.steps]
        session.usage = merge_usage(session.usage, usage.as_dict())
        self.db.commit()
        logger.info(
            "interview.answer_scored",
            extra={"turn": turn.turn_index, "score": turn.score, "skipped": skipped, "difficulty": decision.level, "complete": complete},
        )
        return turn, decision, complete

    def finish(self, session: models.InterviewSession) -> dict:
        """Ends the interview (early or not) and builds the report. Idempotent."""
        if session.status == "completed" and session.report:
            return session.report
        answered = [self._turn_dict(t) for t in session.turns if t.answered_at]
        if not answered:
            raise AppError("Answer at least one question before finishing.", 409)

        with track_usage() as usage:
            report = build_report(session, answered, self._gap(session))
        session.usage = merge_usage(session.usage, usage.as_dict())
        report["usage"] = session.usage

        session.report = report
        session.overall_score = report["overall_score"]
        session.status = "completed"
        session.completed_at = datetime.utcnow()
        self.db.commit()
        logger.info(
            "interview.completed",
            extra={"overall_score": report["overall_score"], "answered": len(answered), "total_tokens": session.usage.get("total_tokens", 0)},
        )
        return report

    # ---------------- steps ----------------

    def _ask_next(self, session: models.InterviewSession, trace: Trace) -> models.InterviewTurn:
        with trace.step("topic_selector") as step:
            choice = choose_next_topic(session.plan["topics"], self._history(session), session.max_questions)
            step.update(topic=choice.topic["topic"], follow_up=choice.follow_up, reason=choice.reason)

        with trace.step("resume_retriever") as step:
            chunks, method = [], "none"
            if session.resume_id:
                chunks, method = rag.retrieve(self.db, session.resume_id, f"{choice.topic['topic']} ({choice.topic['skill']})")
            step.update(method=method, chunk_ids=[c.id for c in chunks], scores=[round(c.score, 3) for c in chunks])

        with trace.step("question_generator") as step:
            generated = agents.generate_question(
                choice,
                session.difficulty,
                chunks,
                [self._turn_dict(t) for t in session.turns],
                session.plan.get("role"),
                self._turn_dict(session.turns[-1]) if choice.follow_up else None,
            )
            step["rationale"] = generated["rationale"]

        return self._add_turn(session, choice, generated, trace.steps, source="generated")

    def _grade_and_draft_next(
        self,
        session: models.InterviewSession,
        turn: models.InterviewTurn,
        answer: str,
        chunks: list[rag.RetrievedChunk],
        trace: Trace,
    ) -> tuple[dict, dict]:
        """One LLM call grades the answer and drafts the next question for the score it gives."""
        options = next_question_options(
            session.plan["topics"], self._history(session), session.difficulty, session.max_questions
        )
        contexts: dict[str, dict] = {}
        for option in options:
            name = option.choice.topic["topic"]
            if option.choice.follow_up or name in contexts:
                continue  # a follow-up reuses this question's context
            start = time.perf_counter()
            found, method = [], "none"
            if session.resume_id:
                found, method = rag.retrieve(self.db, session.resume_id, f"{name} ({option.choice.topic['skill']})")
            contexts[name] = {"chunks": found, "method": method, "duration_ms": round((time.perf_counter() - start) * 1000, 1)}

        with trace.step("answer_evaluator") as step:
            result = agents.evaluate_and_draft_next(
                self._turn_dict(turn),
                answer,
                chunks,
                options,
                {name: c["chunks"] for name, c in contexts.items()},
                [self._turn_dict(t) for t in session.turns],
                session.plan.get("role"),
            )
            step.update(score=result["evaluation"]["overall"], drafted_branch=result["branch"])

        option = next((o for o in options if o.label == result["branch"]), None)
        return result["evaluation"], {"option": option, "question": result["next"], "contexts": contexts, "chunks": chunks}

    def _keep_draft_if_chosen(self, session: models.InterviewSession, decision: DifficultyDecision, draft: dict) -> dict:
        """
        Saves the drafted question as the next turn if the policies, run on the
        real score, choose the same topic and level. Otherwise it's dropped and
        /next generates the question the usual way.
        """
        choice = choose_next_topic(session.plan["topics"], self._history(session), session.max_questions)
        option = draft["option"]
        if not option or not draft["question"]["question"] or not option.matches(choice, decision.level):
            logger.info(
                "interview.draft_discarded",
                extra={"drafted": option.label if option else None, "topic": choice.topic["topic"], "level": decision.level},
            )
            return {"branch": option.label if option else None, "used": False}

        if choice.follow_up:
            found, method, duration = draft["chunks"], "reused", 0.0
        else:
            context = draft["contexts"][option.choice.topic["topic"]]
            found, method, duration = context["chunks"], context["method"], context["duration_ms"]
        steps = [
            {"agent": "topic_selector", "duration_ms": 0.0, "tokens": 0, "topic": choice.topic["topic"], "follow_up": choice.follow_up, "reason": choice.reason},
            {"agent": "resume_retriever", "duration_ms": duration, "tokens": 0, "method": method, "chunk_ids": [c.id for c in found], "scores": [round(c.score, 3) for c in found]},
            {"agent": "question_generator", "duration_ms": 0.0, "tokens": 0, "rationale": draft["question"]["rationale"], "drafted_by": "answer_evaluator"},
        ]
        self._add_turn(session, choice, draft["question"], steps, source="drafted")
        return {"branch": option.label, "used": True}

    def _add_turn(
        self, session: models.InterviewSession, choice: TopicChoice, generated: dict, steps: list[dict], source: str
    ) -> models.InterviewTurn:
        turn = models.InterviewTurn(
            turn_index=len(session.turns) + 1,
            topic=choice.topic["topic"],
            skill=choice.topic["skill"],
            category=choice.topic["category"],
            difficulty=session.difficulty,
            is_follow_up=choice.follow_up,
            question=generated["question"],
            question_type=generated["question_type"],
            expected_points=generated["expected_points"],
            trace=steps,
        )
        session.turns.append(turn)
        self.db.flush()
        logger.info(
            "interview.question_asked",
            extra={"turn": turn.turn_index, "topic": turn.topic, "difficulty": turn.difficulty, "follow_up": turn.is_follow_up, "source": source},
        )
        return turn

    # ---------------- helpers ----------------

    @staticmethod
    def _pending(session: models.InterviewSession) -> models.InterviewTurn | None:
        last = session.turns[-1] if session.turns else None
        return last if last and last.answered_at is None else None

    @staticmethod
    def _require_active(session: models.InterviewSession) -> None:
        if session.status != "active":
            raise AppError("This interview has already finished.", 409)

    @staticmethod
    def _history(session: models.InterviewSession) -> list[TurnSummary]:
        return [TurnSummary(t.topic, t.difficulty, t.score, t.skipped, t.is_follow_up) for t in session.turns]

    @staticmethod
    def _turn_dict(turn: models.InterviewTurn) -> dict:
        evaluation = turn.evaluation or {}
        return {
            "turn_index": turn.turn_index,
            "topic": turn.topic,
            "skill": turn.skill,
            "category": turn.category,
            "difficulty": turn.difficulty,
            "question": turn.question,
            "question_type": turn.question_type,
            "expected_points": turn.expected_points,
            "score": turn.score,
            "skipped": turn.skipped,
            "evaluation": evaluation,
            "missed_points": evaluation.get("missed_points", []),
        }

    def _context_for(self, turn: models.InterviewTurn) -> list[rag.RetrievedChunk]:
        """The resume chunks the question was written from, so grading sees the same context."""
        step = next((s for s in turn.trace if s["agent"] == "resume_retriever" and s.get("chunk_ids")), None)
        if not step:
            return []
        rows = {c.id: c for c in self.db.query(models.ResumeChunk).filter(models.ResumeChunk.id.in_(step["chunk_ids"]))}
        return [
            rag.RetrievedChunk(cid, rows[cid].section, rows[cid].content, score)
            for cid, score in zip(step["chunk_ids"], step.get("scores", [0.0] * len(step["chunk_ids"])))
            if cid in rows
        ]

    def _gap(self, session: models.InterviewSession) -> dict | None:
        if not (session.resume_id and session.job_description_id):
            return None
        row = skill_gap.find_analysis(self.db, session.resume_id, session.job_description_id)
        return row.result if row else None
