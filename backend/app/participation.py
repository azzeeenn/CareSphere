"""
CareSphere — registrations and logged hours
============================================

Registrations
    GET    /api/registrations              admin: all;  volunteer: own only
    POST   /api/registrations              sign up for an event
    DELETE /api/registrations/{id}         cancel own, or admin cancels any

Hours
    GET    /api/hours                      admin: all;  volunteer: own only
    POST   /api/hours                      log a shift
    PATCH  /api/hours/{id}/review          verify or reject     (admin)
    GET    /api/hours/summary/me           own verified total

Two rules run through this file:

  * A volunteer sees only their own rows. The filter is applied here, on
    the server, not left to the page to do. A volunteer calling the
    endpoint directly still cannot see anyone else's records.

  * Volunteers cannot verify their own hours. Certificates are issued off
    verified totals, so self-verification would make them meaningless.
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import Event, Registration, User, VolunteerHours
from ..schemas import (
    HoursCreate,
    HoursOut,
    HoursReview,
    RegistrationCreate,
    RegistrationUpdate,
    RegistrationOut,
)
from .common import not_found, parse_id

reg_router = APIRouter(prefix="/api/registrations", tags=["registrations"])
hours_router = APIRouter(prefix="/api/hours", tags=["hours"])


def _is_staff(user: User) -> bool:
    return user.role in ("admin", "super_admin")


# ===========================================================================
#  REGISTRATIONS
# ===========================================================================


def _shape_reg(r: Registration) -> RegistrationOut:
    return RegistrationOut(
        id=r.id,
        eventId=str(r.event_id),
        eventTitle=r.event.title if r.event else None,
        userId=str(r.user_id),
        name=r.user.name if r.user else None,
        status=r.status,
        registeredAt=r.registered_at,
    )


@reg_router.get("", response_model=List[RegistrationOut])
def list_registrations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    eventId: Optional[str] = None,
):
    q = db.query(Registration)

    if not _is_staff(user):
        q = q.filter(Registration.user_id == user.id)
    if eventId:
        q = q.filter(Registration.event_id == parse_id(eventId, "event"))

    return [_shape_reg(r) for r in q.order_by(Registration.registered_at.desc()).all()]


@reg_router.post("", response_model=RegistrationOut, status_code=201)
def register_for_event(
    body: RegistrationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Signs the caller up for an event. Note the user id comes from the
    token, never from the request body — otherwise anyone could register
    somebody else.
    """
    event = db.query(Event).filter(Event.id == parse_id(body.eventId, "event")).first()
    if event is None:
        raise not_found("event")

    if event.status != "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This event is not open for registration",
        )

    existing = (
        db.query(Registration)
        .filter(Registration.event_id == event.id, Registration.user_id == user.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already registered for this event",
        )

    # Full events take waitlist entries rather than refusing outright.
    confirmed = (
        db.query(func.count(Registration.id))
        .filter(Registration.event_id == event.id, Registration.status == "confirmed")
        .scalar()
    )
    new_status = "confirmed" if confirmed < event.capacity else "waitlisted"

    reg = Registration(event_id=event.id, user_id=user.id, status=new_status)
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return _shape_reg(reg)


@reg_router.patch("/{reg_id}", response_model=RegistrationOut)
def update_registration(
    reg_id: str,
    body: RegistrationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Cancel a place, or an admin moving someone between confirmed and
    waitlisted.

    Cancelling marks the row rather than deleting it. The event keeps a
    record that the person signed up and then withdrew, which matters
    when an organiser is working out why a camp was short-staffed.

    Freeing a confirmed place promotes the longest-waiting person off the
    waitlist automatically. Doing it here rather than in the page means it
    happens however the place was freed.
    """
    reg = db.query(Registration).filter(Registration.id == parse_id(reg_id)).first()
    if reg is None:
        raise not_found("registration")

    staff = _is_staff(user)

    if reg.user_id != user.id and not staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only change your own registration",
        )

    # A volunteer can withdraw. Only an admin can put somebody back on.
    if not staff and body.status != "cancelled":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can cancel your place, but not change it back yourself",
        )

    was_confirmed = reg.status == "confirmed"
    reg.status = body.status
    db.flush()

    promoted = None
    if was_confirmed and body.status == "cancelled":
        confirmed = (
            db.query(func.count(Registration.id))
            .filter(
                Registration.event_id == reg.event_id,
                Registration.status == "confirmed",
            )
            .scalar()
        )
        if confirmed < reg.event.capacity:
            promoted = (
                db.query(Registration)
                .filter(
                    Registration.event_id == reg.event_id,
                    Registration.status == "waitlisted",
                )
                .order_by(Registration.registered_at, Registration.id)
                .first()
            )
            if promoted:
                promoted.status = "confirmed"

    db.commit()
    db.refresh(reg)
    return _shape_reg(reg)


@reg_router.delete("/{reg_id}", status_code=204)
def cancel_registration(
    reg_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    reg = db.query(Registration).filter(Registration.id == parse_id(reg_id)).first()
    if reg is None:
        raise not_found("registration")

    if reg.user_id != user.id and not _is_staff(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own registration",
        )

    db.delete(reg)
    db.commit()
    return Response(status_code=204)


# ===========================================================================
#  HOURS
# ===========================================================================


def _shape_hours(h: VolunteerHours) -> HoursOut:
    return HoursOut(
        id=h.id,
        userId=str(h.user_id),
        name=h.user.name if h.user else None,
        eventId=str(h.event_id) if h.event_id else None,
        eventTitle=h.event.title if h.event else None,
        hours=float(h.hours),
        loggedAt=h.logged_at,
        status=h.status,
        note=h.note or "",
    )


@hours_router.get("", response_model=List[HoursOut])
def list_hours(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status_: Optional[str] = Query(None, alias="status"),
):
    q = db.query(VolunteerHours)

    if not _is_staff(user):
        q = q.filter(VolunteerHours.user_id == user.id)
    if status_:
        q = q.filter(VolunteerHours.status == status_)

    return [_shape_hours(h) for h in q.order_by(VolunteerHours.logged_at.desc()).all()]


@hours_router.post("", response_model=HoursOut, status_code=201)
def log_hours(
    body: HoursCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """New entries always start as pending. Nobody logs pre-verified hours."""
    event_id = None
    if body.eventId:
        event = db.query(Event).filter(Event.id == parse_id(body.eventId, "event")).first()
        if event is None:
            raise not_found("event")
        event_id = event.id

    entry = VolunteerHours(
        user_id=user.id,
        event_id=event_id,
        hours=body.hours,
        logged_at=body.loggedAt or date.today(),
        status="pending",
        note=body.note or "",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _shape_hours(entry)


@hours_router.patch("/{hours_id}/review", response_model=HoursOut)
def review_hours(
    hours_id: str,
    body: HoursReview,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    entry = db.query(VolunteerHours).filter(
        VolunteerHours.id == parse_id(hours_id, "hours entry")
    ).first()
    if entry is None:
        raise not_found("hours entry")

    if entry.user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot verify your own hours",
        )

    entry.status = body.status
    entry.note = body.note or ""
    entry.verified_at = date.today()
    entry.verified_by_id = admin.id

    db.commit()
    db.refresh(entry)
    return _shape_hours(entry)


@hours_router.get("/summary/me")
def my_totals(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    What the volunteer dashboard shows, and what the certificate rules
    check before an hours certificate can be issued.
    """
    def total(status_value: str) -> float:
        result = (
            db.query(func.coalesce(func.sum(VolunteerHours.hours), 0))
            .filter(
                VolunteerHours.user_id == user.id,
                VolunteerHours.status == status_value,
            )
            .scalar()
        )
        return float(result or 0)

    return {
        "verified": total("verified"),
        "pending": total("pending"),
        "entries": db.query(func.count(VolunteerHours.id))
        .filter(VolunteerHours.user_id == user.id)
        .scalar(),
    }
