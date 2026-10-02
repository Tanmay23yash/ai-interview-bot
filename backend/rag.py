"""
Resume RAG: split a resume into section-aware chunks, embed and store them,
then retrieve the chunks most relevant to an interview topic.

If embeddings are unavailable (no API key, quota, outage), chunks are still
stored and retrieval falls back to keyword overlap, so interviews keep
working with slightly weaker grounding.
"""
import logging
import math
import re
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import func, text
from sqlalchemy.orm import Session

import gemini
import models
from gemini import AIServiceError
from vector_store import cosine_similarity, pgvector_enabled, to_pgvector

logger = logging.getLogger("hiremind.rag")

CHUNK_CHARS = 900
OVERLAP_CHARS = 150

# Substrings that mark a line as a resume section heading ("TECHNICAL SKILLS", "Work Experience:").
_SECTION_WORDS = (
    "summary", "profile", "objective", "experience", "employment", "work history", "internship",
    "project", "education", "skill", "technolog", "certification", "achievement", "award",
    "publication", "leadership", "activit", "volunteer", "course", "language", "interest",
    "extracurricular", "responsibilit", "research",
)
_STOPWORDS = set(
    "a an and are as at be by for from has have how i in is it its of on or that the this to was were what "
    "when where which who why will with you your do does did can could would should about into using use".split()
)


@dataclass
class Chunk:
    section: str
    content: str


@dataclass
class RetrievedChunk:
    id: int
    section: str
    content: str
    score: float


# ---------------- CHUNKING ----------------

def _heading(line: str) -> str | None:
    """The section name if this line looks like a resume heading, else None."""
    bare = line.rstrip(":").strip()
    words = bare.split()
    if not words or len(words) > 5 or len(bare) > 48 or re.search(r"[\d@|•]", bare):
        return None
    if not any(w in bare.lower() for w in _SECTION_WORDS):
        return None
    if bare.isupper() or bare.istitle() or line.endswith(":") or len(words) <= 2:
        return bare.title()
    return None


def split_sections(text: str) -> list[tuple[str, list[str]]]:
    sections: list[tuple[str, list[str]]] = []
    name, lines = "Profile", []
    for raw in text.splitlines():
        line = " ".join(raw.split())
        if not line:
            continue
        heading = _heading(line)
        if heading:
            if lines:
                sections.append((name, lines))
            name, lines = heading, []
        else:
            lines.append(line)
    if lines:
        sections.append((name, lines))
    return sections


def _split_long(line: str, max_chars: int) -> list[str]:
    """Breaks an over-long line at sentence ends, then at word boundaries."""
    if len(line) <= max_chars:
        return [line]
    pieces, current = [], ""
    for part in re.split(r"(?<=[.;!?])\s+", line):
        for word in part.split(" ") if len(part) > max_chars else [part]:
            candidate = f"{current} {word}".strip()
            if current and len(candidate) > max_chars:
                pieces.append(current)
                candidate = word
            current = candidate
    if current:
        pieces.append(current)
    return pieces


def _overlap_tail(lines: list[str], overlap: int) -> list[str]:
    tail, size = [], 0
    for line in reversed(lines):
        if size + len(line) > overlap:
            break
        tail.insert(0, line)
        size += len(line) + 1
    return tail


def chunk_resume(text: str, max_chars: int = CHUNK_CHARS, overlap: int = OVERLAP_CHARS) -> list[Chunk]:
    """Chunks never cross a section boundary; neighbours share up to `overlap` chars of whole lines."""
    chunks: list[Chunk] = []
    for section, lines in split_sections(text):
        current: list[str] = []
        size = 0
        for piece in (p for line in lines for p in _split_long(line, max_chars)):
            if current and size + len(piece) > max_chars:
                chunks.append(Chunk(section, "\n".join(current)))
                current = _overlap_tail(current, overlap)
                size = sum(len(c) + 1 for c in current)
                if size + len(piece) > max_chars:
                    current, size = [], 0
            current.append(piece)
            size += len(piece) + 1
        if current:
            chunks.append(Chunk(section, "\n".join(current)))
    return chunks


# ---------------- INDEXING ----------------

def index_resume(db: Session, resume: models.Resume) -> dict:
    """(Re)builds the chunks for one resume. Embedding failures leave chunks unembedded, not missing."""
    chunks = chunk_resume(resume.extracted_text or "")
    embeddings = None
    if chunks:
        try:
            embeddings = gemini.embed_texts([f"{c.section}\n{c.content}" for c in chunks])
        except AIServiceError:
            logger.warning("rag.embedding_failed", extra={"resume_id": resume.id, "chunks": len(chunks)})

    db.query(models.ResumeChunk).filter(models.ResumeChunk.resume_id == resume.id).delete()
    db.add_all(
        models.ResumeChunk(
            resume_id=resume.id,
            chunk_index=i,
            section=c.section,
            content=c.content,
            embedding=embeddings[i] if embeddings else None,
        )
        for i, c in enumerate(chunks)
    )
    db.commit()

    result = {"chunks": len(chunks), "embedded": embeddings is not None}
    logger.info("rag.indexed", extra={"resume_id": resume.id, **result})
    return result


def ensure_indexed(db: Session, resume: models.Resume) -> dict:
    """Indexes resumes uploaded before RAG existed, and retries embeddings that failed earlier."""
    total, embedded = (
        db.query(func.count(models.ResumeChunk.id), func.count(models.ResumeChunk.embedding))
        .filter(models.ResumeChunk.resume_id == resume.id)
        .one()
    )
    if total == 0 or embedded < total:
        return index_resume(db, resume)
    return {"chunks": total, "embedded": True}


# ---------------- RETRIEVAL ----------------

def retrieve(db: Session, resume_id: int, query: str, k: int = 4) -> tuple[list[RetrievedChunk], str]:
    """The k chunks most relevant to `query`, and which method found them ("vector" or "keyword")."""
    try:
        query_vector = gemini.embed_texts([query], task_type="RETRIEVAL_QUERY")[0]
    except AIServiceError:
        query_vector = None

    if query_vector is not None:
        hits = _vector_search(db, resume_id, query_vector, k)
        if hits:
            return hits, "vector"
    return _keyword_search(db, resume_id, query, k), "keyword"


def _vector_search(db: Session, resume_id: int, query_vector: list[float], k: int) -> list[RetrievedChunk]:
    if pgvector_enabled():
        rows = db.execute(
            text(
                "SELECT id, section, content, 1 - (embedding <=> CAST(:q AS vector)) AS score "
                "FROM resume_chunks WHERE resume_id = :rid AND embedding IS NOT NULL "
                "ORDER BY embedding <=> CAST(:q AS vector) LIMIT :k"
            ),
            {"q": to_pgvector(query_vector), "rid": resume_id, "k": k},
        ).all()
        return [RetrievedChunk(r.id, r.section, r.content, float(r.score)) for r in rows]

    rows = (
        db.query(models.ResumeChunk)
        .filter(models.ResumeChunk.resume_id == resume_id, models.ResumeChunk.embedding.isnot(None))
        .all()
    )
    scored = [RetrievedChunk(c.id, c.section, c.content, cosine_similarity(query_vector, c.embedding)) for c in rows]
    return sorted(scored, key=lambda c: c.score, reverse=True)[:k]


def _terms(text_: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9][a-z0-9+#.]*", text_.lower()) if t not in _STOPWORDS]


def _keyword_search(db: Session, resume_id: int, query: str, k: int) -> list[RetrievedChunk]:
    rows = (
        db.query(models.ResumeChunk)
        .filter(models.ResumeChunk.resume_id == resume_id)
        .order_by(models.ResumeChunk.chunk_index)
        .all()
    )
    wanted = set(_terms(query))

    def score(chunk: models.ResumeChunk) -> float:
        counts = Counter(_terms(f"{chunk.section} {chunk.content}"))
        hits = sum(1 + math.log(counts[t]) for t in wanted if counts[t])
        return hits / math.sqrt(sum(counts.values()) or 1)

    scored = [RetrievedChunk(c.id, c.section, c.content, round(score(c), 4)) for c in rows]
    # Stable sort: with no matches at all, the top of the resume is still useful context.
    return sorted(scored, key=lambda c: c.score, reverse=True)[:k]


def format_context(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return "(no resume excerpts available)"
    return "\n\n".join(f"[{c.section}]\n{c.content}" for c in chunks)
