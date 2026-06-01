# - Pydantic request and response models for the auth endpoints.
# - These define the API contract between the backend and the frontend.
# - Login and signup send JSON bodies and receive { access_token, token_type }.
# - /me returns { userId, email, name } in camelCase to match the frontend.
# - Password minimum is 8 characters and maximum is 72 characters.

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Requests (what the frontend sends) ---

# - Request body for POST /api/v1/auth/login.
# - min_length of 1 on password prevents empty values from slipping through.
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


# - Request body for POST /api/v1/auth/signup.
# - Password is capped at 72 chars because bcrypt silently truncates beyond that, so we reject it here instead.
# - min_length on name and password prevents empty values from slipping through.
class SignupRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=72)


# --- Responses (what the backend returns) ---

# - Returned by both login and signup.
# - Matches the frontend AuthResponse type: { "access_token": "...", "token_type": "bearer" }.
# - token_type defaults to "bearer" so we never have to set it manually.
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# - Returned by GET /api/v1/auth/me.
# - user_id is stored as snake_case in the database but the frontend expects camelCase userId.
# - serialization_alias handles that translation so the emitted JSON matches the frontend without renaming anything in the DB.
# - password_hash is intentionally absent since a password hash must never be sent to the client.
class UserResponse(BaseModel):
    # from_attributes lets Pydantic read fields off a SQLAlchemy model object instead of a dict.
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    # serialization_alias renames user_id to userId only in the outgoing JSON.
    user_id: str = Field(serialization_alias="userId")
    email: str
    name: str
