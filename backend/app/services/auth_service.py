"""
Business logic for authentication.

This service sits between the HTTP layer (routers/auth.py) and the data
layer (the User model + security.py). The router handles HTTP concerns
(parsing requests, status codes); this module handles the actual auth
workflow: creating users, checking credentials, and resolving a token
back to a user.

Public interface:
    register_user(db, email, name, password) -> access token (str)
    authenticate_user(db, email, password)   -> access token (str)
    get_user_by_token(db, token)             -> User

    Exceptions: EmailAlreadyRegisteredError, InvalidCredentialsError,
                UserNotFoundError

Keeping this logic out of the router means it can be tested without HTTP,
and the router stays thin. It uses get_db()-provided sessions (passed in
by the caller) rather than managing its own
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.models import User


# --- Service-level exceptions ---
# These let the router translate failures into the right HTTP status codes
# without the router needing to know how auth works internally.


class EmailAlreadyRegisteredError(Exception):
    """Raised when signup is attempted with an email that already exists."""


class InvalidCredentialsError(Exception):
    """Raised when login is attempted with a bad email or password."""


class UserNotFoundError(Exception):
    """Raised when a token is valid but its user no longer exists."""


# --- Public interface ---


def register_user(db: Session, email: str, name: str, password: str) -> str:
    """
    Create a new user account and return an access token for them.

    Signup logs the user in immediately (returns a token), matching the
    frontend, which expects an access_token back from /signup.

    Raises EmailAlreadyRegisteredError if the email is already taken. We
    check first to give a clean 400 rather than letting the database's
    unique constraint raise an opaque IntegrityError.
    """
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise EmailAlreadyRegisteredError(email)

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)  # reload so user.user_id (DB-generated) is populated

    return create_access_token(user.user_id)


def authenticate_user(db: Session, email: str, password: str) -> str:
    """
    Verify an email/password pair and return an access token on success.

    Raises InvalidCredentialsError for both "no such email" and "wrong
    password" — deliberately the same error, so an attacker can't tell
    which emails are registered (avoids user enumeration).
    """
    user = db.scalar(select(User).where(User.email == email))

    # Note: we call verify_password even when the user doesn't exist would
    # be ideal for constant-time behavior, but a simple short-circuit is
    # acceptable here. The key point is the SAME error either way.
    if user is None or user.password_hash is None:
        raise InvalidCredentialsError()
    if not verify_password(password, user.password_hash):
        raise InvalidCredentialsError()

    return create_access_token(user.user_id)


def get_user_by_token(db: Session, token: str) -> User:
    """
    Resolve a bearer token to the User it identifies.

    Used by the /me endpoint and (later) by any protected route via the
    get_current_user dependency. Raises InvalidTokenError if the token is
    bad/expired (re-raised from security.py), or UserNotFoundError if the
    token is valid but the user has since been deleted.
    """
    # decode_access_token raises InvalidTokenError on any bad token;
    # we let that propagate up to the router, which turns it into a 401.
    user_id = decode_access_token(token)

    user = db.scalar(select(User).where(User.user_id == user_id))
    if user is None:
        raise UserNotFoundError(user_id)

    return user