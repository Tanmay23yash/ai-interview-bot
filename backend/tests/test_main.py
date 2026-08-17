from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


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
            "email": "testuser@example.com",
            "password": "TestPassword123"
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
            "email": "testuser@example.com",
            "password": "TestPassword123"
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "User already exists"


def test_login():
    response = client.post(
        "/auth/login",
        json={
            "email": "testuser@example.com",
            "password": "TestPassword123"
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
            "email": "testuser@example.com",
            "password": "WrongPassword"
        }
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_resumes_requires_authentication():
    response = client.get("/resumes")

    assert response.status_code == 403