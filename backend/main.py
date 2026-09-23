from dotenv import load_dotenv
load_dotenv()
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from auth import get_current_user
from fastapi import UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi import UploadFile, File
import pdfplumber
import os
from auth import get_current_user
from gemini import generate_questions



from database import SessionLocal, engine
import models, schemas
from auth import hash_password, verify_password, create_access_token
from auth import create_reset_token, decode_reset_token, _password_fingerprint
from mailer import send_reset_email

# Create DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {"status": "Backend running"}


@app.post("/auth/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(models.User).filter(
            models.User.email == user.email
        ).first()

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
    except Exception as e:
        db.rollback()
        print("REGISTER ERROR:", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.post("/auth/login", response_model=schemas.Token)
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(
        models.User.email == user.email
    ).first()

    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": db_user.email})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/resume/upload")
async def upload_resume(
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
            text += page.extract_text() or ""

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

    return {
        "resume_id": resume_row.id
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
        except Exception as e:
            print("FORGOT PASSWORD EMAIL ERROR:", e)

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
