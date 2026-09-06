"""
CareSphere — districts and categories
======================================

    GET /api/districts
    GET /api/categories

Both public. These were hardcoded arrays in store.js; serving them means
the NGO can open a seventh district from the admin panel without anyone
editing code, and every dropdown on the site picks it up automatically.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Category, District
from ..schemas import LookupOut

router = APIRouter(tags=["lookups"])


@router.get("/api/districts", response_model=List[LookupOut])
def list_districts(db: Session = Depends(get_db)):
    return db.query(District).order_by(District.name).all()


@router.get("/api/categories", response_model=List[LookupOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.name).all()
