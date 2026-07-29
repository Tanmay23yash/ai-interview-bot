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




