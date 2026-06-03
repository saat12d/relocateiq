# - HTTP layer for authentication — translates between HTTP and the auth service.
# - Reads validated request bodies via Pydantic schemas, calls the service, and maps exceptions to HTTP status codes.
# - No auth logic lives here, that all lives in services/auth_service.py.
# - Endpoints: POST /signup (201): creates new account and logs user in immediately
# - POST /login (200): verifies credentials and issues an access token to the user
# - GET /me (200): returns the currently authenticated user

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.schemas.auth import (
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# --- Endpoints ---

# - Creates a new account and returns a token so the user is logged in immediately after signup.
# - Returns 201 on success, 400 if the email is already taken, 422 if validation fails.
@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(req: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        # Pass the validated fields to the service to create the user and mint a token.
        token = auth_service.register_user(
            db, email=req.email, name=req.name, password=req.password
        )
    except auth_service.EmailAlreadyRegisteredError:
        # Service raises this when the email is already in the database then we map it to a 400.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with that email already exists.",
        )
    # Wrap the token in the response schema so FastAPI serializes it correctly.
    return TokenResponse(access_token=token)


# - Verifies credentials and returns a token on success.
# - Returns 200 on success, 401 on bad email or password, 422 if validation fails.
@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        # Service handles both the DB lookup and password check.
        token = auth_service.authenticate_user(
            db, email=req.email, password=req.password
        )
    except auth_service.InvalidCredentialsError:
        # Same 401 for wrong password and unknown email. This avoids leaking which emails are registered.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    return TokenResponse(access_token=token)


# - Returns the currently authenticated user and all the real work happens in get_current_user.
# - FastAPI serializes the User through UserResponse, which emits camelCase userId and omits password_hash.
@router.get("/me", response_model=UserResponse)
def read_current_user(
    user: User = Depends(get_current_user),
) -> User:
    return user