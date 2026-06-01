# - Business logic for authentication, sitting between the HTTP layer (routers/auth.py) and the data layer.
# - The router handles HTTP concerns
# - This module handles the actual auth workflow.
# - Public interface: register_user, authenticate_user, get_user_by_token.
# - Keeping logic here instead of in the router means it can be tested without HTTP.

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

# Raised when signup is attempted with an email that already exists.
class EmailAlreadyRegisteredError(Exception):
    pass

# Raised when login is attempted with a bad email or password.
class InvalidCredentialsError(Exception):
    pass

# Raised when a token is valid but the user it points to no longer exists.
class UserNotFoundError(Exception):
    pass


# --- Public interface ---

# - Creates a new user account and returns an access token so the user is logged in immediately.
# - Raises EmailAlreadyRegisteredError if the email is taken (we check first to avoid an opaque DB IntegrityError).
def register_user(db: Session, email: str, name: str, password: str) -> str:
    # Query the database to see if this email is already in use.
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise EmailAlreadyRegisteredError(email)

    # Build the new User object with a hashed password (never store plaintext).
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
    )
    # Write the new user to the database.
    db.add(user)
    db.commit()
    # Refresh so user.user_id is populated from the DB-generated value.
    db.refresh(user)

    # Mint and return a token so the frontend can log the user in immediately.
    return create_access_token(user.user_id)


# - Verifies an email and password pair and returns an access token on success.
# - Raises InvalidCredentialsError for both unknown email and wrong password to prevent user enumeration.
def authenticate_user(db: Session, email: str, password: str) -> str:
    # Look up the user by email.
    user = db.scalar(select(User).where(User.email == email))

    # Raise the same error whether the email is unknown or the password is wrong.
    # This prevents an attacker from probing which emails are registered.
    if user is None or user.password_hash is None:
        raise InvalidCredentialsError()
    if not verify_password(password, user.password_hash):
        raise InvalidCredentialsError()

    # Credentials are valid so mint and return a fresh token.
    return create_access_token(user.user_id)


# - Resolves a bearer token to the User it identifies.
# - Raises InvalidTokenError if the token is bad or expired, or UserNotFoundError if the user was deleted.
def get_user_by_token(db: Session, token: str) -> User:
    # Decode and verify the token. InvalidTokenError propagates up to the router which turns it into a 401.
    user_id = decode_access_token(token)

    # Look up the user by the id extracted from the token.
    user = db.scalar(select(User).where(User.user_id == user_id))
    if user is None:
        # Token is cryptographically valid but the account was deleted after it was issued.
        raise UserNotFoundError(user_id)

    return user
