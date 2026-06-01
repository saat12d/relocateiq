# - This file is for the auth module and will be the single source of truth for password hashing and JWT token handling.
# - Public interface: hash_password, verify_password, create_access_token, decode_access_token, InvalidTokenError.
# - Everything else in this file is a private implementation detail (prefixed with _).
# - This file doesn't handle requests, talk to the database, or log anyone in

import os
from datetime import datetime, timedelta, timezone
import bcrypt
from jose import JWTError, jwt
from dotenv import load_dotenv

# Load variables from backend/.env into the environment before we read them.
load_dotenv()

# --- Private configuration ---

# JWT (JSON Web Token): a compact, signed string that proves who the user is without hitting the database.
# Loaded from the environment so the secret never lives in source control.
_JWT_SECRET = os.getenv("JWT_SECRET")
if not _JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set. Add it to backend/.env (any long random "
        "string for local dev; a secure secret in production)."
    )

# HS256 is a symmetric algorithm which is the same secret used to sign and verify tokens.
_JWT_ALGORITHM = "HS256"

# this is the token lifetime
_ACCESS_TOKEN_EXPIRE_MINUTES = 60

# --- Public interface ---

# Custom exception that wraps all token failures (bad signature, expired, malformed, missing claims) under one type.
# - Hides jose's internal exception from the rest of the codebase so we're not leaking implementation details.
# - Lets the router catch one predictable exception type and return a 401.
class InvalidTokenError(Exception):
    pass


# - Takes a plaintext password and returns a bcrypt hash safe to store in the database.
# - Bcrypt auto-generates a unique salt each call, so the same password hashes differently every time.
def hash_password(plain_password: str) -> str:
    # Encode the string to bytes since bcrypt operates on bytes, not strings.
    password_bytes = plain_password.encode("utf-8")
    # hashpw hashes the password and embeds the generated salt in the output.
    hashed_bytes = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    # Decode back to a string so it can be stored in the database as text.
    return hashed_bytes.decode("utf-8")


# - Checks a plaintext password against a stored hash and returns True or False.
# - Never raises on a wrong password so callers should treat False the same as "user not found" to avoid user enumeration (mentioned in test files)
def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Encode both inputs to bytes so bcrypt can compare them.
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    # checkpw extracts the salt from the hash and re-hashes the plaintext to compare.
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# - Mints a signed JWT for the given user_id and returns it as an opaque string.
# - The token encodes sub (user id), iat (issued at), and exp (expiry) — use decode_access_token() to read it back.
def create_access_token(user_id: str) -> str:
    # Capture the current UTC time so both iat and exp are consistent.
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),   # sub is the JWT standard claim for "subject" (who the token is about)
        "iat": now,             # issued-at timestamp, useful for debugging
        "exp": now + timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES),  # token expires after 60 minutes
    }
    # Encode and sign the payload with our secret so that it returns a compact JWT string.
    return jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)


# - Verifies a JWT and returns the user_id it contains, or raises InvalidTokenError if anything is wrong.
# - "Anything wrong" includes: bad signature, expired, malformed, or missing the sub claim.
def decode_access_token(token: str) -> str:
    try:
        # jwt.decode checks the signature AND the expiry and then raises JWTError if either fails.
        payload = jwt.decode(token, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
    except JWTError as exc:
        # Wrap jose's exception in our own type so callers only need to catch InvalidTokenError.
        raise InvalidTokenError(str(exc)) from exc

    # Extract the user id from the sub claim.
    user_id = payload.get("sub")
    if not user_id:
        # A token with no sub is structurally valid but useless so we treat it the same as a forgery.
        raise InvalidTokenError("Token has no subject claim.")
    return user_id
