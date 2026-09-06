"""
CareSphere — events
====================

    GET    /api/events            list, with optional ?status= &district= &category=
    GET    /api/events/{id}       one event
    POST   /api/events            create            (admin)
    PATCH  /api/events/{id}       update            (admin)
    DELETE /api/events/{id}       delete            (super admin)

The 'registered' count is calculated from the registrations table on every
read rather than stored on the event. A stored counter drifts — your seed
data already had an event claiming 15 registrations with no registration
records behind it.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin, require_super_admin
from ..database import get_db
from ..models import Category, District, Event, Registration, User
from ..schemas import EventCreate, EventOut, EventUpdate
from .common import category_id_for, district_id_for, not_found, parse_id

router = APIRouter(prefix="/api/events", tags=["events"])


def _counts(db: Session) -> dict:
    """{event_id: confirmed registrations} in a single query."""
    rows = (
        db.query(Registration.event_id, func.count(Registration.id))
        .filter(Registration.status == "confirmed")
        .group_by(Registration.event_id)
        .all()
    )
    return {event_id: n for event_id, n in rows}


def _shape(event: Event, registered: int = 0) -> EventOut:
    """Turn a database row into the shape the frontend expects."""
    return EventOut(
        id=event.id,
        title=event.title,
        category=event.category.name if event.category else None,
        district=event.district.name if event.district else None,
        venue=event.venue,
        startsAt=event.starts_at,
        endsAt=event.ends_at,
        capacity=event.capacity,
        registered=registered,
        status=event.status,
        description=event.description,
        createdAt=event.created_at,
    )


@router.get("", response_model=List[EventOut])
def list_events(
    db: Session = Depends(get_db),
    status_: Optional[str] = Query(None, alias="status"),
    district: Optional[str] = None,
    category: Optional[str] = None,
):
    """
    Public. The site's events page calls this with no filter; the admin
    panel passes ?status=draft and so on.
    """
    q = db.query(Event)

    if status_:
        q = q.filter(Event.status == status_)
    if district:
        q = q.join(District).filter(District.name == district)
    if category:
        q = q.join(Category).filter(Category.name == category)

    events = q.order_by(Event.starts_at.desc()).all()
    counts = _counts(db)

    return [_shape(e, counts.get(e.id, 0)) for e in events]


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == parse_id(event_id, "event")).first()
    if event is None:
        raise not_found("event")
    return _shape(event, _counts(db).get(event.id, 0))


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    body: EventCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    event = Event(
        title=body.title,
        category_id=category_id_for(db, body.category),
        district_id=district_id_for(db, body.district),
        venue=body.venue,
        starts_at=body.startsAt,
        ends_at=body.endsAt,
        capacity=body.capacity,
        status=body.status,
        description=body.description,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _shape(event, 0)


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    body: EventUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    event = db.query(Event).filter(Event.id == parse_id(event_id, "event")).first()
    if event is None:
        raise not_found("event")

    # exclude_unset means untouched fields are left alone rather than
    # being overwritten with None.
    changes = body.model_dump(exclude_unset=True)

    if "category" in changes:
        event.category_id = category_id_for(db, changes.pop("category"))
    if "district" in changes:
        event.district_id = district_id_for(db, changes.pop("district"))
    if "startsAt" in changes:
        event.starts_at = changes.pop("startsAt")
    if "endsAt" in changes:
        event.ends_at = changes.pop("endsAt")

    for field, value in changes.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return _shape(event, _counts(db).get(event.id, 0))


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """
    Super admin only, matching the admin panel's rule that deletes are
    restricted. Registrations for the event go with it (cascade); logged
    hours survive with their event link set to null, so a volunteer's
    record is never silently reduced.
    """
    event = db.query(Event).filter(Event.id == parse_id(event_id, "event")).first()
    if event is None:
        raise not_found("event")

    db.delete(event)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
