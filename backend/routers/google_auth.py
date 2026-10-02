"""Sign up / log in with Google.

The browser gets an ID token from Google Identity Services and posts it here.
We check its signature, audience, issuer and expiry, then find or create the
account by its Google-verified email and return our usual access token. The
feature is off (the button stays hidden) until GOOGLE_CLIENT_ID is set.
"""
import functools
import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from google.auth import exceptions as google_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from auth import login_token, unusable_password
from database import get_db

router = APIRouter(prefix="/auth/google", tags=["auth"])
logger = logging.getLogger("hiremind.auth")

# Fetching Google's signing keys is the only network call here; don't let it hang a request.
_google_request = functools.partial(google_requests.Request(), timeout=10)
CLOCK_SKEW_SECONDS = 10


def client_id() -> str | None:
    return os.getenv("GOOGLE_CLIENT_ID", "").strip() or None


def verify_credential(credential: str, audience: str) -> dict:
    try:
        return id_token.verify_oauth2_token(
            credential, _google_request, audience, clock_skew_in_seconds=CLOCK_SKEW_SECONDS
        )
    except google_exceptions.TransportError:
        logger.exception("auth.google_unreachable")
        raise HTTPException(status_code=502, detail="Couldn't reach Google to check your sign-in. Please try again.")
    except (ValueError, google_exceptions.GoogleAuthError) as exc:
        logger.warning("auth.google_token_rejected", extra={"reason": str(exc)[:200]})
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")


def _first_name(claims: dict) -> str | None:
    name = claims.get("given_name") or (claims.get("name") or "").split(" ")[0]
    return " ".join(str(name).split())[:50] or None


def _find_user(db: Session, email: str) -> models.User | None:
    # Case-insensitive, so Jane@Example.com from the password form and jane@example.com from Google are one account.
    return (
        db.query(models.User)
        .filter(func.lower(models.User.email) == email.lower())
        .order_by(models.User.id)
        .first()
    )


@router.get("/config")
def google_config():
    # The client ID is public (it ships to every browser); None tells the page to hide the button.
    return {"client_id": client_id()}


@router.post("", response_model=schemas.Token)
def google_sign_in(body: schemas.GoogleSignInRequest, db: Session = Depends(get_db)):
    audience = client_id()
    if not audience:
        raise HTTPException(status_code=503, detail="Google sign-in isn't set up on this server.")

    claims = verify_credential(body.credential, audience)
    email = claims.get("email")
    if not email or str(claims.get("email_verified")).lower() != "true":
        raise HTTPException(status_code=401, detail="Your Google account has no verified email address.")

    user = _find_user(db, email)
    created = user is None
    if created:
        user = models.User(email=email, hashed_password=unusable_password(), first_name=_first_name(claims))
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # A parallel request (a double click) created it first; use that one.
            db.rollback()
            user = _find_user(db, email)
            created = False

    # Accounts made with the password form before names existed pick it up here.
    if not user.first_name and _first_name(claims):
        user.first_name = _first_name(claims)
        db.commit()

    logger.info("auth.google_sign_in", extra={"user_id": user.id, "new_account": created})
    return {"access_token": login_token(user), "token_type": "bearer"}
