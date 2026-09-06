"""
CareSphere — auth routes
=========================

    POST /api/auth/login            email + password  -> token + user
    POST /api/auth/register         public volunteer sign-up
    GET  /api/auth/me               who am I? (requires token)
    POST /api/auth/change-password  requires token
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import create_access_token, get_current_user
from ..database import get_db
from ..models import User
from ..schemas import (
    LoginRequest,
    LoginResponse,
    Message,
    PasswordChangeRequest,
    RegisterRequest,
    UserOut,
)
from ..security import hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Note the deliberately vague error message. Saying "no such email"
    would let anyone test which addresses have accounts, so a wrong email
    and a wrong password give the identical response.
    """
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )

    return LoginResponse(token=create_access_token(user), user=UserOut.model_validate(user))


@router.post("/register", response_model=LoginResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """
    Public sign-up. Always creates a volunteer — the role is hardcoded
    here rather than taken from the request, so nobody can register
    themselves as an admin.
    """
    email = body.email.strip().lower()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        )

    user = User(
        name=body.name.strip(),
        email=email,
        password_hash=hash_password(body.password),
        role="volunteer",
        active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return LoginResponse(token=create_access_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    """
    Lets the frontend confirm a stored token is still valid on page load,
    and refresh the user's name and role if an admin changed them.
    """
    return user


@router.post("/change-password", response_model=Message)
def change_password(
    body: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.currentPassword, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user.password_hash = hash_password(body.newPassword)
    db.commit()

    return Message(detail="Password updated")
