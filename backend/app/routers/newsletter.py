"""
CareSphere: newsletter sign-ups
================================

The "Stay Updated" box on the public site used to say "You're
subscribed" without saving anything. It now stores the email here.

  POST    /api/newsletter          anyone        sign up
  GET     /api/newsletter          admin         the list
  PATCH   /api/newsletter/{id}     admin         switch someone on/off
  DELETE  /api/newsletter/{id}     super admin   remove completely

Signing up twice is harmless: the email is stored lower-cased and is
unique, so the second attempt just answers "already subscribed". If
someone had been switched off, signing up again switches them back on.
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer
from sqlalchemy.orm import Session

from ..auth import require_admin, require_super_admin
from ..database import get_db
from ..models import Subscriber, User
from .common import not_found, parse_id

router = APIRouter(prefix="/api/newsletter", tags=["newsletter"])


class SubscribeBody(BaseModel):
    email: EmailStr


class SubscriberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int = Field(serialization_alias="_id")
    email: str
    subscribedAt: datetime = Field(validation_alias="subscribed_at")
    active: bool

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class SubscriberUpdate(BaseModel):
    active: bool


@router.post("")
def subscribe(body: SubscribeBody, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    row = db.query(Subscriber).filter(Subscriber.email == email).first()

    if row and row.active:
        return {"status": "already"}

    if row:
        row.active = True
    else:
        db.add(Subscriber(email=email, subscribed_at=datetime.utcnow(), active=True))
        response.status_code = 201

    db.commit()
    return {"status": "subscribed"}


@router.get("", response_model=List[SubscriberOut])
def list_subscribers(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(Subscriber).order_by(Subscriber.subscribed_at.desc()).all()


@router.patch("/{sub_id}", response_model=SubscriberOut)
def update_subscriber(
    sub_id: str,
    body: SubscriberUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = db.query(Subscriber).filter(Subscriber.id == parse_id(sub_id, "subscriber")).first()
    if row is None:
        raise not_found("subscriber")
    row.active = body.active
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{sub_id}", status_code=204)
def delete_subscriber(
    sub_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(Subscriber).filter(Subscriber.id == parse_id(sub_id, "subscriber")).first()
    if row is None:
        raise not_found("subscriber")
    db.delete(row)
    db.commit()
    return Response(status_code=204)
