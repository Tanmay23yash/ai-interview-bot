"""Resume RAG endpoints: rebuild a resume's chunk index and preview retrieval."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import models
import rag
from database import get_db
from deps import current_user, owned_resume

router = APIRouter(prefix="/resumes", tags=["resume-rag"])


@router.post("/{resume_id}/index")
def reindex_resume(resume_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    return rag.index_resume(db, owned_resume(db, user, resume_id))


@router.get("/{resume_id}/search")
def search_resume(
    resume_id: int,
    q: str = Query(min_length=2, max_length=300),
    k: int = Query(4, ge=1, le=10),
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
):
    rag.ensure_indexed(db, owned_resume(db, user, resume_id))
    chunks, method = rag.retrieve(db, resume_id, q, k)
    return {
        "method": method,
        "results": [{"id": c.id, "section": c.section, "content": c.content, "score": round(c.score, 4)} for c in chunks],
    }
