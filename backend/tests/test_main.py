from uuid import uuid4

from fastapi.testclient import TestClient

from main import app


client = TestClient(app)

TEST_EMAIL = f"testuser_{uuid4().hex}@example.com"
TEST_PASSWORD = "TestPassword123"


def test_root():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "status": "Backend running"
    }


def test_register_user():
    response = client.post(
        "/auth/register",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "User created"
    }


def test_duplicate_registration():
    response = client.post(
        "/auth/register",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "User already exists"


def test_login():
    response = client.post(
        "/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_invalid_login():
    response = client.post(
        "/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": "WrongPassword"
        }
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_resumes_requires_authentication():
    response = client.get("/resumes")

    assert response.status_code == 403


def test_get_resumes_user_not_found():
    # Create a valid JWT for an email that does not exist in the database
    from auth import create_access_token
    fake_email = f"ghost_{uuid4().hex}@example.com"
    token = create_access_token({"sub": fake_email})

    response = client.get(
        "/resumes",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"

def _register_and_capture_reset_link(monkeypatch, email, password):
    import main

    client.post("/auth/register", json={"email": email, "password": password})

    sent = {}
    monkeypatch.setattr(main, "send_reset_email", lambda to, link: sent.update(to=to, link=link))

    response = client.post("/auth/forgot-password", json={"email": email})
    assert response.status_code == 200
    return sent


def test_forgot_password_unknown_email_gives_same_response(monkeypatch):
    import main

    sent = {}
    monkeypatch.setattr(main, "send_reset_email", lambda to, link: sent.update(to=to))

    response = client.post(
        "/auth/forgot-password",
        json={"email": f"nobody_{uuid4().hex}@example.com"},
    )

    assert response.status_code == 200
    assert "reset link" in response.json()["message"]
    assert sent == {}


def test_reset_password_flow_and_single_use(monkeypatch):
    email = f"reset_{uuid4().hex}@example.com"
    sent = _register_and_capture_reset_link(monkeypatch, email, "OldPassword123")
    token = sent["link"].split("token=")[1]

    # A reset token must never work as a login token.
    assert client.get("/resumes", headers={"Authorization": f"Bearer {token}"}).status_code == 401

    response = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewPassword456"},
    )
    assert response.status_code == 200

    assert client.post("/auth/login", json={"email": email, "password": "OldPassword123"}).status_code == 401
    assert client.post("/auth/login", json={"email": email, "password": "NewPassword456"}).status_code == 200

    # The same link cannot be used twice.
    reused = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "AnotherPassword789"},
    )
    assert reused.status_code == 400


def test_reset_password_rejects_bad_token_and_short_password(monkeypatch):
    bad = client.post(
        "/auth/reset-password",
        json={"token": "not-a-real-token", "new_password": "LongEnough123"},
    )
    assert bad.status_code == 400

    email = f"short_{uuid4().hex}@example.com"
    sent = _register_and_capture_reset_link(monkeypatch, email, "OldPassword123")
    token = sent["link"].split("token=")[1]

    short = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "short"},
    )
    assert short.status_code == 422
