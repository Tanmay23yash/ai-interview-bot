from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    # Optional for older clients; the signup form always sends it.
    first_name: str | None = Field(None, max_length=50)

    @field_validator("first_name")
    @classmethod
    def tidy_first_name(cls, value: str | None) -> str | None:
        cleaned = " ".join((value or "").split())
        return cleaned or None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str


class GoogleSignInRequest(BaseModel):
    # The ID token (a JWT) that Google Identity Services hands the browser.
    credential: str = Field(min_length=1, max_length=4096)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class GapAnalysisRequest(BaseModel):
    resume_id: int
    job_description_id: int
    refresh: bool = False


class InterviewStartRequest(BaseModel):
    resume_id: int
    job_description_id: int | None = None
    max_questions: int = Field(8, ge=3, le=15)
    starting_difficulty: int = Field(2, ge=1, le=5)


class AnswerRequest(BaseModel):
    answer: str = Field("", max_length=8000)
    skipped: bool = False

    @model_validator(mode="after")
    def answer_required_unless_skipped(self):
        if not self.skipped and not self.answer.strip():
            raise ValueError("Write an answer, or skip the question")
        return self
