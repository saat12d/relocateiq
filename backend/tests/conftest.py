"""Shared fixtures for the scenario/listings test suites.

Provides `authenticated_client`: an async httpx client wired to the app with a
real signed-up user's JWT attached. Auth state lives in an in-memory SQLite
database (via the get_db override), and scenario persistence is pinned to the
scenario_store's in-memory fallback so tests never touch the dev Postgres.
"""

import os

# security.py reads JWT_SECRET at import time, so set it before importing the app.
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.security import decode_access_token
from app.db.database import Base, get_db
from app.db import models  # noqa: F401  (registers all models on Base)
from app.main import app
from app.repositories import scenario_store


@pytest.fixture
def _sqlite_session():
    """Fresh in-memory SQLite database for one test (used for auth/user rows)."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest_asyncio.fixture
async def authenticated_client(_sqlite_session):
    """An async client with a signed-up user's bearer token, returned as
    (client, user_id). Scenario persistence runs against the in-memory store."""

    def _override_get_db():
        try:
            yield _sqlite_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    # Pin scenario persistence to the in-memory fallback so it never reaches Postgres.
    original_db_ready = scenario_store._DB_READY
    scenario_store._DB_READY = False
    scenario_store.reset_memory_store()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        signup = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": "filter-tester@example.com",
                "name": "Filter Tester",
                "password": "password123",
            },
        )
        assert signup.status_code == 201, signup.text
        token = signup.json()["access_token"]
        user_id = decode_access_token(token)
        client.headers["Authorization"] = f"Bearer {token}"

        yield client, user_id

    app.dependency_overrides.clear()
    scenario_store.reset_memory_store()
    scenario_store._DB_READY = original_db_ready
