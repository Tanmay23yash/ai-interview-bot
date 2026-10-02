from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, Float, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import uuid4
from database import Base
from vector_store import Embedding


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    # Shown on the dashboard. From the signup form or Google; older accounts may have none.
    first_name = Column(String(50), nullable=True)

    resumes = relationship("Resume", back_populates="user")


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    extracted_text = Column(Text, nullable=False)
    questions = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    user = relationship("User", back_populates="resumes")


class ResumeChunk(Base):
    """A section-aware slice of a resume with its embedding, used for retrieval."""

    __tablename__ = "resume_chunks"

    id = Column(Integer, primary_key=True)
    # Retrieval is always scoped to one resume (tens of rows), so a btree on
    # resume_id plus an exact distance sort beats an ANN index here.
    resume_id = Column(Integer, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    section = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Embedding(), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    company = Column(String, nullable=True)
    filename = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SkillGapAnalysis(Base):
    """Cached resume-vs-JD comparison; one row per (resume, job) pair."""

    __tablename__ = "skill_gap_analyses"
    __table_args__ = (UniqueConstraint("resume_id", "job_description_id"),)

    id = Column(Integer, primary_key=True)
    resume_id = Column(Integer, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False)
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False)
    match_score = Column(Float, nullable=False)
    result = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class InterviewSession(Base):
    """One adaptive interview. The UUID id is the session ID used in URLs and logs."""

    __tablename__ = "interview_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # SET NULL: deleting a resume or job keeps the interview history and its report.
    resume_id = Column(Integer, ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True)
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    status = Column(String, nullable=False, default="active")  # active | completed
    max_questions = Column(Integer, nullable=False)
    difficulty = Column(Integer, nullable=False)  # current level, 1-5
    plan = Column(JSONB, nullable=False)  # {"candidate_summary", "role", "topics": [...]}
    usage = Column(JSONB, nullable=False, default=dict)  # LLM calls, tokens, latency
    report = Column(JSONB, nullable=True)
    overall_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    turns = relationship(
        "InterviewTurn",
        back_populates="session",
        order_by="InterviewTurn.turn_index",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class InterviewTurn(Base):
    """One question, the answer to it, and its evaluation."""

    __tablename__ = "interview_turns"
    __table_args__ = (UniqueConstraint("session_id", "turn_index"),)

    id = Column(Integer, primary_key=True)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    turn_index = Column(Integer, nullable=False)  # 1-based
    topic = Column(String, nullable=False)
    skill = Column(String, nullable=False)
    category = Column(String, nullable=False)
    difficulty = Column(Integer, nullable=False)
    is_follow_up = Column(Boolean, nullable=False, default=False)
    question = Column(Text, nullable=False)
    question_type = Column(String, nullable=False)
    expected_points = Column(JSONB, nullable=False)  # grading rubric, hidden until answered
    trace = Column(JSONB, nullable=False)  # agent steps that produced and graded this turn
    answer = Column(Text, nullable=True)
    skipped = Column(Boolean, nullable=False, default=False)
    evaluation = Column(JSONB, nullable=True)
    score = Column(Float, nullable=True)  # 0-10
    asked_at = Column(DateTime, default=datetime.utcnow)
    answered_at = Column(DateTime, nullable=True)

    session = relationship("InterviewSession", back_populates="turns")
