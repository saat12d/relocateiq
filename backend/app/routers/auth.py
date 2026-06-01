"""
HTTP layer for authentication.

This router translates between HTTP and the auth service. It reads 
validated request bodies (via the Pydantic schemas), calls the service 
to do the actual work, and maps the service's exceptions to the right 
HTTP status codes. No auth logic lives here — that's all in 
services/auth_service.py.

Endpoints:

  POST /api/v1/auth/signup
    Purpose: create a new account and log the user in immediately.
    Body:    { email: str, name: str, password: str (8-72 chars) }
    Returns: 201 { access_token: str, token_type: "bearer" }
    Errors:  400 (email already registered), 422 (validation failed)

  POST /api/v1/auth/login
    Purpose: verify credentials and issue an access token.
    Body:    { email: str, password: str }
    Returns: 200 { access_token: str, token_type: "bearer" }
    Errors:  401 (invalid email or password), 422 (validation failed)

  GET /api/v1/auth/me
    Purpose: return the currently-authenticated user.
    Header:  Authorization: Bearer <token>
    Returns: 200 { userId: str, email: str, name: str }
    Errors:  401 (missing/invalid/expired token, or user no longer exists)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import InvalidTokenError
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

# Extracts the "Authorization: Bearer <token>" header. FastAPI returns a 403
# automatically if the header is missing/malformed; we convert token problems
# discovered later into 401s in get_current_user.
_bearer_scheme = HTTPBearer(auto_error=True)


# --- The dependency every protected route will use ---


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Resolve the bearer token in the request to the User who owns it.

    This is the seam other features plug into: any endpoint that needs the
    logged-in user just adds `user: User = Depends(get_current_user)` to its
    signature. The token-decoding and lookup details stay hidden in the
    service + security layers.

    Raises 401 for any untrustworthy token or user that disappears.
    """
    token = credentials.credentials
    try:
        return auth_service.get_user_by_token(db, token)
    except (InvalidTokenError, auth_service.UserNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# --- Endpoints ---


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(req: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Create an account and return an access token (logs the user in)."""
    try:
        token = auth_service.register_user(
            db, email=req.email, name=req.name, password=req.password
        )
    except auth_service.EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with that email already exists.",
        )
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Verify credentials and return an access token."""
    try:
        token = auth_service.authenticate_user(
            db, email=req.email, password=req.password
        )
    except auth_service.InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def read_current_user(
    user: User = Depends(get_current_user),
) -> User:
    """
    Return the currently-authenticated user.

    All the work happens in get_current_user; if we reach this function the
    token was valid. FastAPI serializes the User through UserResponse, which
    emits userId (camelCase) and omits password_hash.
    """
    return user