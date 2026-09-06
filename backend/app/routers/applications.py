"""
CareSphere — volunteer applications
====================================

    GET   /api/applications             admin: all;  volunteer: own only
    GET   /api/applications/me          own application, or 404 if none
    GET   /api/applications/{id}        one, admin or the owner
    POST  /api/applications             submit (one per volunteer)
    PATCH /api/applications/{id}/review approve / reject / more_info  (admin)

There is no 'not_submitted' status. A volunteer who has not applied has
no row here at all, and /me returns 404 — the dashboard shows the empty
state from that. Storing a row for something that has not happened would
mean carrying a status that means "this record should not exist".
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import Application, Category, District, User
from ..schemas import ApplicationCreate, ApplicationOut, ApplicationReview
from .common import category_id_for, district_id_for, not_found, parse_id

router = APIRouter(prefix="/api/applications", tags=["applications"])


def _is_staff(user: User) -> bool:
    return user.role in ("admin", "super_admin")


def _shape(a: Application) -> ApplicationOut:
    return ApplicationOut(
        id=a.id,
        userId=str(a.user_id),
        name=a.user.name if a.user else None,
        email=a.user.email if a.user else None,
        phone=a.phone,
        city=a.city,
        district=a.district.name if a.district else None,
        interest=a.category.name if a.category else None,
        availability=a.availability,
        hoursPerWeek=a.hours_per_week,
        skills=a.skills,
        experience=a.experience,
        motivation=a.motivation,
        emergencyName=a.emergency_name,
        emergencyPhone=a.emergency_phone,
        status=a.status,
        submittedAt=a.submitted_at,
        reviewedAt=a.reviewed_at,
        reviewedBy=a.reviewed_by.name if a.reviewed_by else None,
        note=a.note or "",
    )


@router.get("", response_model=List[ApplicationOut])
def list_applications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status_: Optional[str] = Query(None, alias="status"),
    district: Optional[str] = None,
):
    q = db.query(Application)

    if not _is_staff(user):
        q = q.filter(Application.user_id == user.id)
    if status_:
        q = q.filter(Application.status == status_)
    if district:
        q = q.join(District).filter(District.name == district)

    rows = q.order_by(Application.submitted_at.desc()).all()
    return [_shape(a) for a in rows]


@router.get("/me", response_model=ApplicationOut)
def my_application(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    app_row = db.query(Application).filter(Application.user_id == user.id).first()
    if app_row is None:
        raise not_found("application")
    return _shape(app_row)


@router.patch("/me", response_model=ApplicationOut)
def update_my_application(
    body: ApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Resubmission, for the 'more_info' case — an admin asked for something
    and the volunteer is sending it back.

    Only allowed while the application is pending or more_info. Once it
    has been approved or rejected it is a decided record, and editing it
    afterwards would let someone quietly change what was approved.

    Resubmitting returns it to pending and clears the admin's note, so it
    reappears in the review queue rather than sitting in a state nobody
    is looking at.
    """
    app_row = db.query(Application).filter(Application.user_id == user.id).first()
    if app_row is None:
        raise not_found("application")

    if app_row.status not in ("pending", "more_info"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This application has already been {app_row.status}",
        )

    app_row.phone = body.phone
    app_row.city = body.city
    app_row.district_id = district_id_for(db, body.district)
    app_row.category_id = category_id_for(db, body.interest)
    app_row.availability = body.availability
    app_row.hours_per_week = body.hoursPerWeek
    app_row.skills = body.skills or ""
    app_row.experience = body.experience or ""
    app_row.motivation = body.motivation
    app_row.emergency_name = body.emergencyName
    app_row.emergency_phone = body.emergencyPhone

    app_row.status = "pending"
    app_row.note = ""
    app_row.submitted_at = date.today()
    app_row.reviewed_at = None
    app_row.reviewed_by_id = None

    db.commit()
    db.refresh(app_row)
    return _shape(app_row)


@router.get("/{app_id}", response_model=ApplicationOut)
def get_application(
    app_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    app_row = db.query(Application).filter(
        Application.id == parse_id(app_id, "application")
    ).first()
    if app_row is None:
        raise not_found("application")

    if app_row.user_id != user.id and not _is_staff(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own application",
        )

    return _shape(app_row)


@router.post("", response_model=ApplicationOut, status_code=201)
def submit_application(
    body: ApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    One application per person, enforced by a unique constraint on
    user_id as well as this check — so even two simultaneous submissions
    cannot both get through.
    """
    if db.query(Application).filter(Application.user_id == user.id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already submitted an application",
        )

    app_row = Application(
        user_id=user.id,
        phone=body.phone,
        city=body.city,
        district_id=district_id_for(db, body.district),
        category_id=category_id_for(db, body.interest),
        availability=body.availability,
        hours_per_week=body.hoursPerWeek,
        skills=body.skills or "",
        experience=body.experience or "",
        motivation=body.motivation,
        emergency_name=body.emergencyName,
        emergency_phone=body.emergencyPhone,
        status="pending",
        submitted_at=date.today(),
        note="",
    )
    db.add(app_row)
    db.commit()
    db.refresh(app_row)
    return _shape(app_row)


@router.patch("/{app_id}/review", response_model=ApplicationOut)
def review_application(
    app_id: str,
    body: ApplicationReview,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Records who reviewed it and when. reviewed_by is a foreign key rather
    than a typed-in name, so the audit trail cannot drift if someone is
    renamed later.
    """
    app_row = db.query(Application).filter(
        Application.id == parse_id(app_id, "application")
    ).first()
    if app_row is None:
        raise not_found("application")

    if app_row.user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot review your own application",
        )

    app_row.status = body.status
    app_row.note = body.note or ""
    app_row.reviewed_at = date.today()
    app_row.reviewed_by_id = admin.id

    db.commit()
    db.refresh(app_row)
    return _shape(app_row)
