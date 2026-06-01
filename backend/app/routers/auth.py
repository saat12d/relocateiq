# - HTTP layer for authentication — translates between HTTP and the auth service.
# - Reads validated request bodies via Pydantic schemas, calls the service, and maps exceptions to HTTP status codes.
# - No auth logic lives here, that all lives in services/auth_service.py.
# - Endpoints: POST /signup (201): creates new account and logs user in immediately
# - POST /login (200): verifies credentials and issues an access token to the user
# - GET /me (200): returns the currently authenticated user

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

# Extracts the "Authorization: Bearer <token>" header and the FastAPI returns 403 automatically if it's missing,
# and we convert token problems found later into 401s inside get_current_user.
_bearer_scheme = HTTPBearer(auto_error=True)


# --- Dependency for protected routes ---

# - Resolves the bearer token in the request to the User who owns it.
# - Any endpoint that needs the logged-in user just adds `user: User = Depends(get_current_user)` to its signature.
# - Raises 401 for any bad token or a user that no longer exists.
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    # Pull the raw token string out of the Authorization header.
    token = credentials.credentials
    try:
        # Delegate to the service which handles both token verification and the DB lookup.
        return auth_service.get_user_by_token(db, token)
    except (InvalidTokenError, auth_service.UserNotFoundError):
        # Any token problem such as a bad signature, expired, or user deleted becomes a 401.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )


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
    # If we reach here the token was valid and the user exists. In this case just return them.
    return user
    #  serializes the User through UserResponse, which
    #  emits userId (camelCase) and omits password_hash.
    return user