"""Tests for authentication endpoints."""
from fastapi.testclient import TestClient


def test_login_success(client: TestClient):
    resp = client.post("/api/v1/auth/login", json={"email": "testadmin@doserelay.com", "password": "Admin@123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient):
    resp = client.post("/api/v1/auth/login", json={"email": "testadmin@doserelay.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_nonexistent_user(client: TestClient):
    resp = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "pass"})
    assert resp.status_code == 401


def test_get_me(client: TestClient, admin_headers: dict):
    resp = client.get("/api/v1/auth/me", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "network_admin"
    assert data["email"] == "testadmin@doserelay.com"


def test_get_me_unauthenticated(client: TestClient):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_health_endpoint(client: TestClient):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"
