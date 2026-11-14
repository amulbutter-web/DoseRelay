"""Test fixtures and shared test database setup."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base import Base, get_db
from app.core.security import get_password_hash
from app.models.user import User

TEST_DATABASE_URL = "sqlite:///./test_doserelay.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Create test users
    admin = User(
        email="testadmin@doserelay.com",
        username="testadmin",
        hashed_password=get_password_hash("Admin@123"),
        full_name="Test Admin",
        role="network_admin",
    )
    pharmacist = User(
        email="testpharm@doserelay.com",
        username="testpharm",
        hashed_password=get_password_hash("Pharma@123"),
        full_name="Test Pharmacist",
        role="pharmacist",
        hospital_id=None,
    )
    db.add_all([admin, pharmacist])
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_token(client):
    resp = client.post("/api/v1/auth/login", json={"email": "testadmin@doserelay.com", "password": "Admin@123"})
    return resp.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}
