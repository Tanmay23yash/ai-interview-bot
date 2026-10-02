"""Job descriptions (pasted or uploaded as PDF) and resume-vs-JD gap analyses."""
import logging

import pdfplumber
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

import models
import schemas
import skill_gap
from database import get_db
from deps import current_user, owned_job, owned_resume

router = APIRouter(tags=["job-descriptions"])
logger = logging.getLogger("hiremind.jobs")

MIN_JOB_CHARS = 80
MAX_JOB_CHARS = 30000


def _job_summary(job: models.JobDescription) -> dict:
    return {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "filename": job.filename,
        "preview": " ".join(job.content.split())[:180],
        "created_at": job.created_at,
    }


def _guess_title(content: str) -> str:
    first = next((line.strip() for line in content.splitlines() if line.strip()), "Job description")
    return first[:80]


@router.post("/job-descriptions", status_code=201)
def create_job_description(
    title: str | None = Form(None, max_length=120),
    company: str | None = Form(None, max_length=120),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
):
    if file is not None and file.filename:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Only PDF files allowed")
        with pdfplumber.open(file.file) as pdf:
            content = "\n".join(page.extract_text() or "" for page in pdf.pages)
        filename = file.filename
    else:
        content, filename = text or "", None

    content = content.strip()
    if len(content) < MIN_JOB_CHARS:
        raise HTTPException(status_code=400, detail="That job description is too short. Paste the full posting.")

    job = models.JobDescription(
        user_id=user.id,
        title=(title or "").strip() or _guess_title(content),
        company=(company or "").strip() or None,
        filename=filename,
        content=content[:MAX_JOB_CHARS],
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {**_job_summary(job), "content": job.content}


@router.get("/job-descriptions")
def list_job_descriptions(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    jobs = (
        db.query(models.JobDescription)
        .filter(models.JobDescription.user_id == user.id)
        .order_by(models.JobDescription.created_at.desc())
        .all()
    )
    return [_job_summary(j) for j in jobs]


@router.get("/job-descriptions/{job_id}")
def get_job_description(job_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    job = owned_job(db, user, job_id)
    return {**_job_summary(job), "content": job.content}


@router.delete("/job-descriptions/{job_id}")
def delete_job_description(job_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    db.delete(owned_job(db, user, job_id))
    db.commit()
    return {"message": "Job description deleted"}


def _analysis_out(row: models.SkillGapAnalysis) -> dict:
    return {
        "id": row.id,
        "resume_id": row.resume_id,
        "job_description_id": row.job_description_id,
        "created_at": row.created_at,
        **row.result,
    }


@router.post("/gap-analyses")
def run_gap_analysis(
    body: schemas.GapAnalysisRequest, db: Session = Depends(get_db), user: models.User = Depends(current_user)
):
    resume = owned_resume(db, user, body.resume_id)
    job = owned_job(db, user, body.job_description_id)
    return _analysis_out(skill_gap.get_or_create_analysis(db, resume, job, body.refresh))


@router.get("/gap-analyses")
def get_gap_analysis(
    resume_id: int, job_description_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)
):
    owned_resume(db, user, resume_id)
    owned_job(db, user, job_description_id)
    row = skill_gap.find_analysis(db, resume_id, job_description_id)
    if not row:
        raise HTTPException(status_code=404, detail="No analysis yet for this resume and job")
    return _analysis_out(row)
