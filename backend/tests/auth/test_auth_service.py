"""
Unit tests for app.services.auth_service.

These test the auth business logic directly against an in-memory database
session (the db_session fixture from conftest.py), without going through
HTTP. If one of these fails, the bug is in the service logic specifically.

Covers, for each function, the happy path AND the failure paths:
  register_user      -> success; duplicate email rejected
  authenticate_user  -> success; wrong password rejected; unknown email rejected
  get_user_by_token  -> success; bad token rejected; vanished user rejected
"""

import pytest

from app.auth.security import InvalidTokenError, decode_access_token
from app.services import auth_service


# --- register_user ---


def test_register_user_creates_user_and_returns_token(db_session):
    """A new signup stores the user and returns a token that decodes to them."""
    token = auth_service.register_user(
        db_session, email="alice@example.com", name="Alice", password="password123"
    )
    # The token should decode to the new user's id.
    user_id = decode_access_token(token)
    assert user_id  # non-empty

    # The user should actually be in the database, with a hashed password.
    from sqlalchemy import select
    from app.db.models import User

    user = db_session.scalar(select(User).where(User.email == "alice@example.com"))
    assert user is not None
    assert user.name == "Alice"
    assert user.password_hash is not None
    assert user.password_hash != "password123"  # never store plaintext
    assert user.password_hash.startswith("$2")  # bcrypt hash


def test_register_user_rejects_duplicate_email(db_session):
    """Signing up twice with the same email raises EmailAlreadyRegisteredError."""
    auth_service.register_user(
        db_session, email="bob@example.com", name="Bob", password="password123"
    )
    with pytest.raises(auth_service.EmailAlreadyRegisteredError):
        auth_service.register_user(
            db_session, email="bob@example.com", name="Bob Again", password="different1"
        )


# --- authenticate_user ---


def test_authenticate_user_succeeds_with_correct_password(db_session):
    """Correct credentials return a token that decodes to the right user."""
    auth_service.register_user(
        db_session, email="carol@example.com", name="Carol", password="password123"
    )
    token = auth_service.authenticate_user(
        db_session, email="carol@example.com", password="password123"
    )
    # Decoding the login token should give the same user as a fresh lookup.
    from sqlalchemy import select
    from app.db.models import User

    user = db_session.scalar(select(User).where(User.email == "carol@example.com"))
    assert decode_access_token(token) == user.user_id


def test_authenticate_user_rejects_wrong_password(db_session):
    """A wrong password raises InvalidCredentialsError."""
    auth_service.register_user(
        db_session, email="dave@example.com", name="Dave", password="password123"
    )
    with pytest.raises(auth_service.InvalidCredentialsError):
        auth_service.authenticate_user(
            db_session, email="dave@example.com", password="wrongpassword"
        )


def test_authenticate_user_rejects_unknown_email(db_session):
    """
    An email that doesn't exist raises the SAME InvalidCredentialsError as a
    wrong password (so attackers can't tell which emails are registered).
    """
    with pytest.raises(auth_service.InvalidCredentialsError):
        auth_service.authenticate_user(
            db_session, email="nobody@example.com", password="password123"
        )


# --- get_user_by_token ---


def test_get_user_by_token_returns_correct_user(db_session):
    """A valid token resolves back to the user it was issued for."""
    token = auth_service.register_user(
        db_session, email="erin@example.com", name="Erin", password="password123"
    )
    user = auth_service.get_user_by_token(db_session, token)
    assert user.email == "erin@example.com"
    assert user.name == "Erin"


def test_get_user_by_token_rejects_bad_token(db_session):
    """A garbage token raises InvalidTokenError."""
    with pytest.raises(InvalidTokenError):
        auth_service.get_user_by_token(db_session, "not-a-real-token")


def test_get_user_by_token_rejects_vanished_user(db_session):
    """
    A validly-signed token for a user who no longer exists raises
    UserNotFoundError. We create a token, then delete the user.
    """
    from sqlalchemy import select
    from app.db.models import User

    token = auth_service.register_user(
        db_session, email="frank@example.com", name="Frank", password="password123"
    )
    user = db_session.scalar(select(User).where(User.email == "frank@example.com"))
    db_session.delete(user)
    db_session.commit()

    with pytest.raises(auth_service.UserNotFoundError):
        auth_service.get_user_by_token(db_session, token)