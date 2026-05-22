"""
Security primitives for the auth module.
 
This module is the single source of truth for two design decisions that are likely to change someday:
 
    1. How we hash passwords (currently bcrypt, called directly).
    2. How we issue and verify session tokens (currently JWTs via python-jose).
 
Public interface:
    hash_password(plain_password)         -> hashed password string
    verify_password(plain_password, hash) -> bool
    create_access_token(user_id)          -> JWT string
    decode_access_token(token)            -> user_id (UUID string)
    InvalidTokenError                     -> exception raised by decode_access_token
 
Anything not in that list is a private implementation detail.

This file will not handle requests, does not talk to the database, and does not "log anyone in." It will just provide the four building blocks for the login flow.
"""

import os
from datetime import datetime, timedelta, timezone
import bcrypt
from jose import JWTError, jwt
from dotenv import load_dotenv

# Load variables from backend/.env into the environment before we read them.
load_dotenv()

# --- Private configuration (implementation details, not part of the interface) ---
 
# JWT signing secret. Loaded from the environment so the secret never lives in source control. The backend will refuse to start if it isn't set, because shipping with a default secret is a serious security mistake.
# What is JWT (JSON Web Token): compact, self contained way to securely transmit information between parties as a signed token
_JWT_SECRET = os.getenv("JWT_SECRET")
if not _JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set. Add it to backend/.env (any long random "
        "string for local dev; a secure secret in production)."
    )
 
# HS256 is symmetric (one shared secret)
_JWT_ALGORITHM = "HS256"

# Token lifetime. 60 minutes
_ACCESS_TOKEN_EXPIRE_MINUTES = 60

# --- Public interface ---

# used for exceptions
class InvalidTokenError(Exception):
    """
    Raised when a token cannot be trusted for any reason: bad signature,
    expired, malformed, or missing required claims.
 
    We need this function because:
    1. Hiding jose's exception class from the rest of the codebase (information hiding, value today)
    2. Giving us a clearly-named, project-owned exception (readability, value today)
    3. Unifying jose errors with our own validation errors under one exception type (clean API, value today)
    """

def hash_password(plain_password: str) -> str:
    """
    Hash a plaintext password using bcrypt.

    Bcrypt automatically generates a unique salt per call and embeds it in
    the output, so two users with the same password produce different hashes.
    The result is safe to store directly in the database; it cannot be
    reversed back into the original password.

    Note: bcrypt only uses the first 72 bytes of a password. Passwords longer
    than this should be rejected at the validation layer (in schemas.py).
    """
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed_bytes.decode("utf-8")
 
 
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check whether a plaintext password matches a previously-hashed one.

    Returns True if it matches, False otherwise. Never raises on a bad
    password — callers should treat False the same way they'd treat
    "no such user," to avoid leaking information about which usernames exist.
    """
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)
 
 
def create_access_token(user_id: str) -> str:
    """
    Mint a signed JWT identifying the given user.
 
    The token's payload contains:
        - sub: the user's id (JWT convention for "subject")
        - exp: the expiry timestamp
        - iat: the time the token was issued (useful for debugging)
 
    Callers receive an opaque string. They should not parse it themselves;
    use decode_access_token() to read it back.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)
 
def decode_access_token(token: str) -> str:
    """
    Verify a JWT and return the user id it identifies.
 
    Raises InvalidTokenError if the token is malformed, has a bad signature,
    is expired, or is otherwise unusable. Callers should treat any exception
    here as "this request is unauthenticated" and respond with 401.
    """
    try:
        payload = jwt.decode(token, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
    except JWTError as exc:
        raise InvalidTokenError(str(exc)) from exc
 
    user_id = payload.get("sub")
    if not user_id:
        # A token with no subject is structurally valid but semantically
        # useless; treat it the same as a forgery.
        raise InvalidTokenError("Token has no subject claim.")
    return user_id
 
