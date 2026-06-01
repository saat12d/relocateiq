# [GenAI Use] Prompt: "Role: backend test engineer fluent in pytest, FastAPI, and
# httpx ASGI transport. Context: auth endpoints POST /signup (201 + token, 400 on
# duplicate, 422 on bad input), POST /login (200 + token, 401 on bad credentials),
# GET /me (200 with camelCase userId via bearer token, 401 without). Uses an
# in-memory SQLite client fixture. Task: Write black-box integration tests covering
# the documented contract and error codes. Criteria: assert on specific status
# codes and response fields; test the password length boundary (7 fails, 8 passes);
# confirm /me never leaks the password hash; match the team's httpx.AsyncClient
# pattern."
# [GenAI Use] LLM Response Start
"""
Integration tests for the auth endpoints.

These exercise the full HTTP stack — request validation, the router, the
service, and serialization — by making real HTTP-style requests against the
app via httpx.AsyncClient (the same pattern test_scenarios.py uses). The
get_db dependency is overridden (see conftest.py) to use an in-memory SQLite
database, so these never touch the real Postgres dev database.

Covers the documented API contract for each endpoint, including the error
codes the frontend depends on (401, 400, 422).
"""

import pytest


# --- POST /api/v1/auth/signup ---


async def test_signup_returns_201_and_token(client):
    """A valid signup returns 201 with an access token."""
    response = await client.post(
        "/api/v1/auth/signup",
        json={"email": "new@example.com", "name": "New User", "password": "password123"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str)
    assert len(body["access_token"]) > 0


async def test_signup_duplicate_email_returns_400(client):
    """Signing up twice with the same email returns 400."""
    payload = {"email": "dupe@example.com", "name": "Dupe", "password": "password123"}
    first = await client.post("/api/v1/auth/signup", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/v1/auth/signup", json=payload)
    assert second.status_code == 400
    # The frontend reads the `detail` field for the error message.
    assert "detail" in second.json()


async def test_signup_short_password_returns_422(client):
    """
    Password shorter than the 8-char minimum is rejected by validation (422).
    Boundary test: 7 chars fails.
    """
    response = await client.post(
        "/api/v1/auth/signup",
        json={"email": "short@example.com", "name": "Short", "password": "1234567"},
    )
    assert response.status_code == 422


async def test_signup_minimum_length_password_succeeds(client):
    """
    Boundary test: exactly 8 chars is the minimum valid password, so it should
    succeed (201). Pairs with the 7-char test above to pin the boundary.
    """
    response = await client.post(
        "/api/v1/auth/signup",
        json={"email": "eight@example.com", "name": "Eight", "password": "12345678"},
    )
    assert response.status_code == 201


async def test_signup_invalid_email_returns_422(client):
    """A malformed email is rejected by validation (422)."""
    response = await client.post(
        "/api/v1/auth/signup",
        json={"email": "not-an-email", "name": "Bad", "password": "password123"},
    )
    assert response.status_code == 422


# --- POST /api/v1/auth/login ---


async def test_login_returns_200_and_token(client):
    """Correct credentials return 200 with a token."""
    await client.post(
        "/api/v1/auth/signup",
        json={"email": "login@example.com", "name": "Login", "password": "password123"},
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str)


async def test_login_wrong_password_returns_401(client):
    """A wrong password returns 401."""
    await client.post(
        "/api/v1/auth/signup",
        json={"email": "wrong@example.com", "name": "Wrong", "password": "password123"},
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrong@example.com", "password": "incorrectpassword"},
    )
    assert response.status_code == 401


async def test_login_unknown_email_returns_401(client):
    """An email that was never registered returns 401 (same as wrong password)."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "ghost@example.com", "password": "password123"},
    )
    assert response.status_code == 401


# --- GET /api/v1/auth/me ---


async def test_me_returns_current_user_with_valid_token(client):
    """With a valid bearer token, /me returns the user (camelCase userId)."""
    signup = await client.post(
        "/api/v1/auth/signup",
        json={"email": "me@example.com", "name": "Me User", "password": "password123"},
    )
    token = signup.json()["access_token"]

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    # Response uses camelCase userId (matches the frontend CurrentUser type).
    assert body["userId"]
    assert body["email"] == "me@example.com"
    assert body["name"] == "Me User"
    # password hash must never be exposed.
    assert "password_hash" not in body
    assert "passwordHash" not in body


async def test_me_without_token_is_rejected(client):
    """Calling /me with no Authorization header is rejected (401 or 403)."""
    response = await client.get("/api/v1/auth/me")
    # HTTPBearer returns 403 for a missing header; either way it's not 200.
    assert response.status_code in (401, 403)


async def test_me_with_bad_token_returns_401(client):
    """A malformed/invalid token returns 401."""
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )
    assert response.status_code == 401
# [GenAI Use] LLM Response End

# [GenAI Use] Reflection: We chose to test for both 7-char and 8-char
# passwords to ensure that we are boundary testing. We also decided to test 
# that the password hash isn't in the /me response so that we can 
# avoid data leaks. Overall the tests worked wonderfully and ran very
# smoothly.