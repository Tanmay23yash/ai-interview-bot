"""Adaptive interview sessions: start, one question at a time, answer, finish, report."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from deps import current_user, owned_job, owned_resume
from interview.orchestrator import InterviewOrchestrator
from interview.policy import LEVELS

router = APIRouter(prefix="/interviews", tags=["interviews"])


def _load(db: Session, user: models.User, session_id: str, lock: bool = False) -> models.InterviewSession:
    query = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == session_id, models.InterviewSession.user_id == user.id
    )
    # Mutating endpoints lock the row so one interview's requests run one at a time.
    session = (query.with_for_update() if lock else query).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview not found")
    return session


def _selection_reason(turn: models.InterviewTurn) -> str | None:
    return next((s.get("reason") for s in turn.trace if s["agent"] == "topic_selector"), None)


def turn_out(turn: models.InterviewTurn) -> dict:
    out = {
        "id": turn.id,
        "turn_index": turn.turn_index,
        "topic": turn.topic,
        "skill": turn.skill,
        "category": turn.category,
        "difficulty": turn.difficulty,
        "difficulty_label": LEVELS[turn.difficulty],
        "is_follow_up": turn.is_follow_up,
        "question": turn.question,
        "question_type": turn.question_type,
        "selection_reason": _selection_reason(turn),
        "asked_at": turn.asked_at,
        "answered": turn.answered_at is not None,
    }
    # The rubric and full agent trace stay hidden until the question is answered.
    if turn.answered_at:
        out.update(
            answer=turn.answer,
            skipped=turn.skipped,
            score=turn.score,
            evaluation=turn.evaluation,
            expected_points=turn.expected_points,
            answered_at=turn.answered_at,
            trace=turn.trace,
        )
    return out


def session_summary(session: models.InterviewSession) -> dict:
    asked = len(session.turns)
    answered = sum(t.answered_at is not None for t in session.turns)
    return {
        "session_id": session.id,
        "title": session.title,
        "status": session.status,
        "resume_id": session.resume_id,
        "job_description_id": session.job_description_id,
        "role": session.plan.get("role"),
        "max_questions": session.max_questions,
        "questions_asked": asked,
        "questions_answered": answered,
        "difficulty": session.difficulty,
        "difficulty_label": LEVELS[session.difficulty],
        "overall_score": session.overall_score,
        "created_at": session.created_at,
        "completed_at": session.completed_at,
    }


def session_out(session: models.InterviewSession) -> dict:
    pending = session.turns[-1] if session.turns and session.turns[-1].answered_at is None else None
    return {
        **session_summary(session),
        "plan": {
            "candidate_summary": session.plan.get("candidate_summary"),
            "topics": [
                {k: t[k] for k in ("topic", "skill", "category", "priority", "source")} for t in session.plan["topics"]
            ],
        },
        "usage": session.usage,
        "turns": [turn_out(t) for t in session.turns],
        "current_question": turn_out(pending) if pending else None,
    }


@router.post("", status_code=201)
def start_interview(
    body: schemas.InterviewStartRequest, db: Session = Depends(get_db), user: models.User = Depends(current_user)
):
    resume = owned_resume(db, user, body.resume_id)
    job = owned_job(db, user, body.job_description_id) if body.job_description_id else None
    session = InterviewOrchestrator(db).start(user, resume, job, body.max_questions, body.starting_difficulty)
    return session_out(session)


@router.get("")
def list_interviews(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    sessions = (
        db.query(models.InterviewSession)
        .filter(models.InterviewSession.user_id == user.id)
        .order_by(models.InterviewSession.created_at.desc())
        .all()
    )
    return [session_summary(s) for s in sessions]


@router.get("/{session_id}")
def get_interview(session_id: str, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    return session_out(_load(db, user, session_id))


@router.post("/{session_id}/next")
def next_question(session_id: str, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    session = _load(db, user, session_id, lock=True)
    turn = InterviewOrchestrator(db).next_question(session)
    return {"question": turn_out(turn), "session": session_summary(session)}


@router.post("/{session_id}/answer")
def answer_question(
    session_id: str,
    body: schemas.AnswerRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
):
    session = _load(db, user, session_id, lock=True)
    turn, decision, complete = InterviewOrchestrator(db).submit_answer(session, body.answer.strip(), body.skipped)
    return {
        "turn": turn_out(turn),
        "difficulty": decision.as_dict(),
        "interview_complete": complete,
        "session": session_summary(session),
    }


@router.post("/{session_id}/finish")
def finish_interview(session_id: str, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    session = _load(db, user, session_id, lock=True)
    return InterviewOrchestrator(db).finish(session)


@router.get("/{session_id}/report")
def get_report(session_id: str, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    session = _load(db, user, session_id)
    if not session.report:
        raise HTTPException(status_code=404, detail="This interview hasn't been finished yet")
    return session.report


@router.delete("/{session_id}")
def delete_interview(session_id: str, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    db.delete(_load(db, user, session_id))
    db.commit()
    return {"message": "Interview deleted"}
