# [GenAI Use] Prompt: "Role: pytest expert. Context: FastAPI app with a get_db
# dependency backed by Postgres; I want auth tests isolated from the real database.
# Task: Write a conftest.py with a fixture providing a fresh in-memory SQLite
# database per test, override the app's get_db dependency to use it, and provide
# an async httpx client (ASGITransport) matching our existing test pattern. Set a
# JWT_SECRET so the suite is self-contained. Criteria: tests never touch the real
# Postgres; clean teardown; override is cleared after each test."
# [GenAI Use] LLM Response Start

"""
Shared test fixtures for the auth test suite.

Fixtures defined in a conftest.py are automatically available to every test
file in this directory (tests/auth/) without importing them.

Strategy:
  - Spin up a fresh in-memory SQLite database for each test (controllability:
    we fully control the starting state, and nothing touches the real
    Postgres dev database).
  - Override the app's get_db dependency so the endpoints use the test
    database instead of Postgres. This is the "test double" pattern from the
    reference doc: we substitute the real DB dependency with a controlled one.
  - Provide an async httpx client wired to the app, matching the pattern the
    team uses in test_scenarios.py.

A JWT_SECRET is set here defensively so the suite is self-contained and does
not depend on a developer's local .env being present.
"""

import os

import pytest
import pytest_asyncio

# Ensure a JWT secret exists before any app code is imported. security.py
# reads JWT_SECRET at import time, so this must run first.
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.db import models  # noqa: F401  (ensures all models register on Base)
from app.main import app


@pytest.fixture
def db_session():
    """
    Create a fresh in-memory SQLite database for a single test, create all
    tables, hand back a session, and tear it all down afterward.

    StaticPool + a shared connection keeps the same in-memory database alive
    across the connections used during one test (in-memory SQLite otherwise
    disappears the moment a connection closes).
    """
    engine = create_engine(
        "sqlite://",  # in-memory
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)

    TestingSessionLocal = sessionmaker(
        bind=engine, autoflush=False, autocommit=False
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    """
    An async HTTP client wired to the FastAPI app, with the app's get_db
    dependency overridden to use the in-memory test database.

    Matches the httpx.AsyncClient + ASGITransport pattern used elsewhere in
    the test suite, so all our auth endpoint tests can make real HTTP-style
    requests without a running server.
    """

    def _override_get_db():
        # Every request during a test reuses the same in-memory session, so
        # data written in one request is visible to the next.
        try:
            yield db_session
        finally:
            pass  # session lifecycle is managed by the db_session fixture

    app.dependency_overrides[get_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as async_client:
        yield async_client

    # Clean up the override so it never leaks into other test files.
    app.dependency_overrides.clear()
# [GenAI Use] LLM Response End

# [GenAI Use] Reflection: For all the tests, we opted to run them 
# through this file so that we could spin up an in-memory SQLite
# database. We chose to do this because when we call get_db to get 
# a session this would normally return a real Postgres session. Using
# SQLite we can avoid this. We also chose to use StaticPool because 
# it forces SQLAlchemy to reuse a single shared connection for the
# entirety of the tests. These tests also worked perfectly. 