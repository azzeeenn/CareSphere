"""
CareSphere — authentication
============================

Everything to do with proving who a request comes from.

How it works:

  1. User posts email + password to /api/auth/login.
  2. We check the password against the bcrypt hash in the database.
  3. We hand back a signed token (a JWT) containing the user's id.
  4. The frontend sends that token on every later request:
         Authorization: Bearer <token>
  5. get_current_user() reads the token, checks the signature, and loads
     that user from the database.

The token is signed, not encrypted. Anyone can read what's inside it, but
nobody can change it without the SECRET_KEY, so we can trust the user id
we find there.

Role checks mirror the three layers already in the frontend. The frontend
hides what a user cannot do; this layer is what actually enforces it. A
volunteer who hand-crafts a DELETE request gets a 403 regardless of what
the admin panel shows them.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from .config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from .database import get_db
from .models import User


# Reads the "Authorization: Bearer ..." header. auto_error=False so we can
# return our own message instead of FastAPI's default.
bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Making tokens
# ---------------------------------------------------------------------------

def create_access_token(user: User) -> str:
    """Build a signed token identifying this user."""
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user.id),      # "subject" — who the token is about
        "role": user.role,        # convenience, still re-checked from the DB
        "exp": expires,           # expiry, enforced by the jwt library
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ---------------------------------------------------------------------------
# Reading tokens
# ---------------------------------------------------------------------------

def _unauthorised(detail: str = "Not signed in") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Add this to any route that requires a signed-in user:

        @router.get("/me")
        def me(user: User = Depends(get_current_user)):
            ...
    """
    if creds is None:
        raise _unauthorised()

    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise _unauthorised("Malformed token")
    except JWTError:
        # Covers a bad signature, a tampered token and an expired one.
        raise _unauthorised("Session expired or invalid — please sign in again")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise _unauthorised("Account no longer exists")
    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )

    return user


# ---------------------------------------------------------------------------
# Role gates
# ---------------------------------------------------------------------------
# The role is re-read from the database rather than trusted from the token,
# so demoting someone takes effect immediately instead of when their token
# happens to expire.

def require_roles(*allowed: str):
    """
    Build a dependency that only lets certain roles through.

        @router.delete("/{id}")
        def remove(user: User = Depends(require_roles("super_admin"))):
            ...
    """
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to do that",
            )
        return user

    return checker


# Ready-made versions of the three cases the admin panel uses.
require_admin = require_roles("admin", "super_admin")
require_super_admin = require_roles("super_admin")
require_volunteer = require_roles("volunteer", "admin", "super_admin")
