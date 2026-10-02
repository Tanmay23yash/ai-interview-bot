import hashlib
import os
import secrets
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


# Set JWT_SECRET when deployed: whoever knows the signing key can forge a login for any user.
# The fallback is only for local development (and keeps existing local sessions valid).
SECRET_KEY = os.getenv("JWT_SECRET") or "SUPER_SECRET_KEY_CHANGE_THIS"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str):
    return pwd_context.verify(password, hashed)

# Accounts created with Google have no password. users.hashed_password is NOT NULL,
# so, like Django, we store a value no password can match; a reset link can still set one.
UNUSABLE_PASSWORD_PREFIX = "!"

def unusable_password() -> str:
    return UNUSABLE_PASSWORD_PREFIX + secrets.token_urlsafe(32)

def has_usable_password(hashed: str | None) -> bool:
    return bool(hashed) and not hashed.startswith(UNUSABLE_PASSWORD_PREFIX)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")

        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        return email

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------------- PASSWORD RESET ----------------
RESET_TOKEN_EXPIRE_MINUTES = 15


def _password_fingerprint(hashed_password: str) -> str:
    # Changes whenever the password changes, so a reset link works only once.
    return hashlib.sha256(hashed_password.encode()).hexdigest()[:16]


def create_reset_token(email: str, hashed_password: str) -> str:
    # Deliberately has no "sub" claim, so it can never be used as a login token.
    payload = {
        "email": email,
        "purpose": "password_reset",
        "fp": _password_fingerprint(hashed_password),
        "exp": datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_reset_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    if payload.get("purpose") != "password_reset" or not payload.get("email"):
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    return payload
