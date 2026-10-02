"""Shared FastAPI dependencies for routes that need the signed-in user's rows."""
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

import models
from auth import get_current_user
from database import get_db


def current_user(db: Session = Depends(get_db), email: str = Depends(get_current_user)) -> models.User:
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def owned_resume(db: Session, user: models.User, resume_id: int) -> models.Resume:
    resume = db.query(models.Resume).filter(models.Resume.id == resume_id, models.Resume.user_id == user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


def owned_job(db: Session, user: models.User, job_id: int) -> models.JobDescription:
    job = (
        db.query(models.JobDescription)
        .filter(models.JobDescription.id == job_id, models.JobDescription.user_id == user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")
    return job
