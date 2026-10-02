"""Sign up / log in with Google. Google's token check is faked; everything else is real."""
from uuid import uuid4

import pytest
from google.auth import exceptions as google_exceptions
from sqlalchemy import func

import models
from auth import create_reset_token, has_usable_password
from database import SessionLocal
from routers import google_auth

CLIENT_ID = "test-client.apps.googleusercontent.com"


@pytest.fixture
def google(monkeypatch):
    """Maps fake credentials to Google claims, and deletes every account the test touched."""
    monkeypatch.setenv("GOOGLE_CLIENT_ID", CLIENT_ID)
    tokens: dict[str, dict | Exception] = {}
    emails: list[str] = []

    def verify(credential, request, audience, clock_skew_in_seconds=0):
        assert audience == CLIENT_ID
        outcome = tokens.get(credential, ValueError("Wrong number of segments in token"))
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(google_auth.id_token, "verify_oauth2_token", verify)

    def issue(email: str | None = None, *, verified=True) -> tuple[str, str]:
        email = email or f"g_{uuid4().hex}@example.com"
        emails.append(email)
        credential = f"cred-{uuid4().hex}"
        tokens[credential] = {"iss": "https://accounts.google.com", "aud": CLIENT_ID, "email": email, "email_verified": verified}
        return credential, email

    issue.tokens = tokens
    issue.emails = emails
    yield issue

    db = SessionLocal()
    lowered = [e.lower() for e in emails]
    db.query(models.User).filter(func.lower(models.User.email).in_(lowered)).delete(synchronize_session=False)
    db.commit()
    db.close()


def _users(email: str) -> list[models.User]:
    db = SessionLocal()
    try:
        return db.query(models.User).filter(models.User.email.ilike(email)).all()
    finally:
        db.close()


def _sign_in(client, credential: str):
    return client.post("/auth/google", json={"credential": credential})


def test_config_is_empty_without_a_client_id(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)

    assert client.get("/auth/google/config").json() == {"client_id": None}
    response = _sign_in(client, "anything")
    assert response.status_code == 503
    assert "isn't set up" in response.json()["detail"]


def test_config_returns_the_public_client_id(client, google):
    assert client.get("/auth/google/config").json() == {"client_id": CLIENT_ID}


def test_first_sign_in_creates_a_passwordless_account(client, google):
    credential, email = google()

    response = _sign_in(client, credential)

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    [user] = _users(email)
    assert not has_usable_password(user.hashed_password)

    # The token works like a password login's.
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/interviews", headers=headers).status_code == 200


def test_signing_in_again_reuses_the_account(client, google):
    credential, email = google()

    assert _sign_in(client, credential).status_code == 200
    assert _sign_in(client, credential).status_code == 200

    assert len(_users(email)) == 1


def test_links_to_an_existing_password_account_ignoring_case(client, google):
    email = f"Mixed_{uuid4().hex}@Example.com"
    google.emails.append(email)
    assert client.post("/auth/register", json={"email": email, "password": "Password123"}).status_code == 200

    credential, _ = google(email.lower())
    response = _sign_in(client, credential)

    assert response.status_code == 200
    assert len(_users(email)) == 1
    # Both ways in keep working.
    assert client.post("/auth/login", json={"email": email, "password": "Password123"}).status_code == 200


def test_rejects_an_unverified_google_email(client, google):
    credential, email = google(verified=False)

    response = _sign_in(client, credential)

    assert response.status_code == 401
    assert "verified" in response.json()["detail"]
    assert _users(email) == []


def test_rejects_a_bad_token(client, google):
    response = _sign_in(client, "not-a-real-token")

    assert response.status_code == 401
    assert response.json()["detail"] == "Google sign-in failed. Please try again."
    assert response.json()["correlation_id"]


def test_reports_when_google_is_unreachable(client, google):
    google.tokens["offline"] = google_exceptions.TransportError("connection refused")

    response = _sign_in(client, "offline")

    assert response.status_code == 502
    assert "Couldn't reach Google" in response.json()["detail"]


def test_password_login_on_a_google_account_explains_what_to_do(client, google):
    credential, email = google()
    _sign_in(client, credential)

    response = client.post("/auth/login", json={"email": email, "password": "whatever123"})

    assert response.status_code == 401
    assert "uses Google sign-in" in response.json()["detail"]


def test_signup_form_on_a_google_account_points_to_google(client, google):
    credential, email = google()
    _sign_in(client, credential)

    response = client.post("/auth/register", json={"email": email, "password": "Password123"})

    assert response.status_code == 400
    assert "Log in with Google" in response.json()["detail"]


def test_a_google_account_can_add_a_password_by_resetting_it(client, google):
    credential, email = google()
    _sign_in(client, credential)
    [user] = _users(email)

    token = create_reset_token(user.email, user.hashed_password)
    response = client.post("/auth/reset-password", json={"token": token, "new_password": "NewPassword123"})

    assert response.status_code == 200
    assert client.post("/auth/login", json={"email": email, "password": "NewPassword123"}).status_code == 200
    # Google keeps working too.
    assert _sign_in(client, credential).status_code == 200
