from dotenv import load_dotenv
load_dotenv()
import logging
import os

import pdfplumber
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, get_db
import models, schemas
from auth import get_current_user
from auth import hash_password, verify_password, create_access_token, has_usable_password
from auth import create_reset_token, decode_reset_token, _password_fingerprint
import rag
from gemini import generate_questions
from mailer import send_reset_email
from observability import CORRELATION_HEADER, RequestContextMiddleware, configure_logging, install_error_handlers
from routers import google_auth, interviews, jobs, resume_index
from vector_store import init_vector_store

configure_logging()
logger = logging.getLogger("hiremind.api")

# Pick pgvector or the real[] fallback first: it decides the embedding column type.
init_vector_store(engine)

# Create DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="HireMind API")
install_error_handlers(app)
# Added before CORS so CORS stays outermost and wraps our JSON 500s too.
app.add_middleware(RequestContextMiddleware)
# The local dev server, plus the deployed site (FRONTEND_URL) once there is one.
CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
if os.getenv("FRONTEND_URL"):
    CORS_ORIGINS.append(os.getenv("FRONTEND_URL").rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[CORRELATION_HEADER],
)
app.include_router(google_auth.router)
app.include_router(resume_index.router)
app.include_router(jobs.router)
app.include_router(interviews.router)


@app.get("/")
def root():
    return {"status": "Backend running"}


@app.post("/auth/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(models.User).filter(
            models.User.email == user.email
        ).first()

        if existing and not has_usable_password(existing.hashed_password):
            raise HTTPException(
                status_code=400,
                detail="This email already has an account that uses Google. Log in with Google instead.",
            )
        if existing:
            raise HTTPException(status_code=400, detail="User already exists")

        new_user = models.User(
            email=user.email,
            hashed_password=hash_password(user.password)
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {"message": "User created"}

    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("auth.register_failed")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.post("/auth/login", response_model=schemas.Token)
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(
        models.User.email == user.email
    ).first()

    if db_user and not has_usable_password(db_user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="This account uses Google sign-in. Log in with Google, or reset your password to add one.",
        )
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": db_user.email})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/resume/upload")
def upload_resume(
    resume: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user)
):
    if resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    user = db.query(models.User).filter(
        models.User.email == user_email
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    text = ""
    with pdfplumber.open(resume.file) as pdf:
        for page in pdf.pages:
            text += (page.extract_text() or "") + "\n"

    questions = generate_questions(text)

    resume_row = models.Resume(
        filename=resume.filename,
        extracted_text=text,
        questions=questions,
        user_id=user.id
    )

    db.add(resume_row)
    db.commit()
    db.refresh(resume_row)

    # The upload has succeeded by now; if indexing fails, interviews re-index on start.
    chunks = 0
    try:
        chunks = rag.index_resume(db, resume_row)["chunks"]
    except Exception:
        db.rollback()
        logger.exception("rag.index_on_upload_failed", extra={"resume_id": resume_row.id})

    return {
        "resume_id": resume_row.id,
        "chunks_indexed": chunks,
    }

@app.get("/resumes")
def get_resumes(
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user)
):
    user = db.query(models.User).filter(
        models.User.email == user_email
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return [
        {
            "id": r.id,
            "filename": r.filename,
            "created_at": r.created_at
        }
        for r in user.resumes
    ]

@app.get("/resumes/{resume_id}")
def get_resume_questions(
    resume_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user)
):
    resume = db.query(models.Resume).join(models.User).filter(
        models.Resume.id == resume_id,
        models.User.email == user_email
    ).first()

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    return {
        "filename": resume.filename,
        "questions": resume.questions
    }

@app.delete("/resumes/{resume_id}")
def delete_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user),
):
    resume = (
        db.query(models.Resume)
        .join(models.User)
        .filter(
            models.Resume.id == resume_id,
            models.User.email == user_email,
        )
        .first()
    )

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    db.delete(resume)
    db.commit()

    return {"message": "Resume deleted successfully"}


@app.post("/auth/forgot-password")
def forgot_password(data: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Same response whether or not the email exists, so accounts can't be probed.
    user = db.query(models.User).filter(models.User.email == data.email).first()

    if user:
        token = create_reset_token(user.email, user.hashed_password)
        frontend = os.getenv("FRONTEND_URL", "http://localhost:5173")
        try:
            send_reset_email(user.email, f"{frontend}/reset-password?token={token}")
        except Exception:
            logger.exception("auth.reset_email_failed")

    return {"message": "If an account exists for that email, a reset link has been sent"}


@app.post("/auth/reset-password")
def reset_password(data: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    payload = decode_reset_token(data.token)

    user = db.query(models.User).filter(models.User.email == payload["email"]).first()

    # Fingerprint mismatch means the password already changed, so the link was used.
    if not user or payload.get("fp") != _password_fingerprint(user.hashed_password):
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    user.hashed_password = hash_password(data.new_password)
    db.commit()

    return {"message": "Password updated successfully"}
