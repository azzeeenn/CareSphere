"""
CareSphere — shared router helpers
===================================

Small functions every resource router needs, kept in one place so the
routers stay short and consistent.
"""

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import Category, District


def parse_id(raw: str, what: str = "record") -> int:
    """
    The frontend sends ids as strings, because that is what the old
    Mongo-shaped store did. Convert to int, with a clean 404 rather than
    a 500 if someone passes nonsense.
    """
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No such {what}",
        )


def not_found(what: str = "record") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"No such {what}",
    )


def district_id_for(db: Session, name: Optional[str]) -> Optional[int]:
    """
    Turn a district name from the frontend into its id.

    Unknown names are rejected rather than silently stored as null, so a
    typo in the admin form surfaces immediately instead of producing an
    event that belongs to nowhere.
    """
    if not name:
        return None
    row = db.query(District).filter(District.name == name).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown district: {name}",
        )
    return row.id


def category_id_for(db: Session, name: Optional[str]) -> Optional[int]:
    """Same as district_id_for, for programme categories."""
    if not name:
        return None
    row = db.query(Category).filter(Category.name == name).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown category: {name}",
        )
    return row.id
