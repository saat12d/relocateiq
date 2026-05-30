"""
Pydantic request/response models for the auth endpoints.

These define the API contract between the backend and the frontend. The
shapes here should match what frontend/src/lib/auth.ts sends and expects:

    - login/signup send JSON bodies and receive { access_token, token_type }
    - /me returns { userId, email, name } (camelCase for the frontend)

The minimum length for the password is 8 characters and the max is 72
"""

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Requests (what the frontend sends) ---


class LoginRequest(BaseModel):
    """Body for POST /api/v1/auth/login."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class SignupRequest(BaseModel):
    """
    Body for POST /api/v1/auth/signup.

    Note the 72-character cap on password: bcrypt only uses the first 72
    bytes, so we reject anything longer here rather than silently truncating.
    The min_length on name/password prevents empty values slipping through.
    """

    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=72)


# --- Responses (what the backend returns) ---


class TokenResponse(BaseModel):
    """
    Returned by both login and signup.

    Matches the frontend's AuthResponse type exactly:
        { "access_token": "...", "token_type": "bearer" }
    The frontend stores access_token itself; we just issue it.
    """

    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """
    Returned by GET /api/v1/auth/me.

    The User model stores user_id (snake_case), but the frontend's
    CurrentUser type expects userId (camelCase). The serialization_alias
    handles that translation so the JSON we emit matches the frontend
    without us having to rename anything in the database.

    password_hash is deliberately absent: a password hash must never be
    sent to the client.
    """

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    user_id: str = Field(serialization_alias="userId")
    email: str
    name: str