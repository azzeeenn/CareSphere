"""
CareSphere — certificates
==========================

    GET   /api/certificates              admin: all;  volunteer: own only
    GET   /api/certificates/types        the four types and what each needs
    GET   /api/certificates/{id}         one, admin or the owner
    POST  /api/certificates              request one
    PATCH /api/certificates/{id}/review  approve / reject   (admin)

The "needs" rules from store.js are enforced here rather than only in the
form. Each type requires different evidence:

    hours          verified hours on record
    completion     verified hours on record
    participation  a confirmed registration for the named event
    recommendation reference contact details

The frontend already asks for the right fields. This layer is what makes
the rule real — a request that skips the form still gets refused.

Certificate numbers are issued at approval, not at request, and run in a
per-year sequence: CS-CERT-2026-0008.
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import Certificate, Event, Registration, User, VolunteerHours
from ..schemas import CertificateCreate, CertificateOut, CertificateReview
from .common import not_found, parse_id

router = APIRouter(prefix="/api/certificates", tags=["certificates"])


# The same list store.js holds, served from one place so the frontend and
# the backend can never disagree about what a type requires.
CERTIFICATE_TYPES = [
    {
        "id": "hours",
        "label": "Volunteering hours certificate",
        "blurb": "States the total hours you've given, verified by an organiser.",
        "needs": "verifiedHours",
    },
    {
        "id": "participation",
        "label": "Event participation certificate",
        "blurb": "Confirms you took part in one particular event.",
        "needs": "event",
    },
    {
        "id": "recommendation",
        "label": "Letter of recommendation",
        "blurb": "A written reference for a job or course application.",
        "needs": "reference",
    },
    {
        "id": "completion",
        "label": "Service completion certificate",
        "blurb": "For college or internship records covering your whole time with us.",
        "needs": "verifiedHours",
    },
]

NEEDS = {t["id"]: t["needs"] for t in CERTIFICATE_TYPES}


def _is_staff(user: User) -> bool:
    return user.role in ("admin", "super_admin")


def _verified_hours(db: Session, user_id: int) -> float:
    total = (
        db.query(func.coalesce(func.sum(VolunteerHours.hours), 0))
        .filter(VolunteerHours.user_id == user_id, VolunteerHours.status == "verified")
        .scalar()
    )
    return float(total or 0)


def _shape(c: Certificate, total_hours: Optional[float] = None) -> CertificateOut:
    return CertificateOut(
        id=c.id,
        userId=str(c.user_id),
        name=c.user.name if c.user else None,
        email=c.user.email if c.user else None,
        type=c.type,
        purpose=c.purpose,
        eventId=str(c.event_id) if c.event_id else "",
        eventTitle=c.event.title if c.event else "",
        referenceName=c.reference_name or "",
        referenceRole=c.reference_role or "",
        referencePhone=c.reference_phone or "",
        requestedAt=c.requested_at,
        status=c.status,
        reviewedAt=c.reviewed_at,
        reviewedBy=c.reviewed_by.name if c.reviewed_by else None,
        note=c.note or "",
        certificateNo=c.certificate_no or "",
        issuedAt=c.issued_at,
        totalHours=total_hours,
        proof=["/" + p.file_path for p in c.proofs],
    )


def _next_certificate_no(db: Session) -> str:
    """
    CS-CERT-<year>-<4 digits>, counting only this year's issued numbers so
    the sequence restarts each January.
    """
    year = date.today().year
    prefix = f"CS-CERT-{year}-"

    used = (
        db.query(Certificate.certificate_no)
        .filter(Certificate.certificate_no.like(f"{prefix}%"))
        .all()
    )

    highest = 0
    for (value,) in used:
        try:
            highest = max(highest, int(value.rsplit("-", 1)[1]))
        except (ValueError, IndexError):
            continue

    return f"{prefix}{highest + 1:04d}"


@router.get("/types")
def list_types():
    """Public. Feeds the request form's type picker."""
    return CERTIFICATE_TYPES


@router.get("", response_model=List[CertificateOut])
def list_certificates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status_: Optional[str] = Query(None, alias="status"),
):
    q = db.query(Certificate)

    if not _is_staff(user):
        q = q.filter(Certificate.user_id == user.id)
    if status_:
        q = q.filter(Certificate.status == status_)

    rows = q.order_by(Certificate.requested_at.desc()).all()

    # Admins reviewing a request need to see the hours behind it.
    return [_shape(c, _verified_hours(db, c.user_id)) for c in rows]


@router.get("/{cert_id}", response_model=CertificateOut)
def get_certificate(
    cert_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cert = db.query(Certificate).filter(
        Certificate.id == parse_id(cert_id, "certificate")
    ).first()
    if cert is None:
        raise not_found("certificate")

    if cert.user_id != user.id and not _is_staff(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own certificates",
        )

    return _shape(cert, _verified_hours(db, cert.user_id))


@router.post("", response_model=CertificateOut, status_code=201)
def request_certificate(
    body: CertificateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    need = NEEDS[body.type]
    event_id = None

    if need == "verifiedHours":
        if _verified_hours(db, user.id) <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You need verified hours on record before requesting this certificate",
            )

    elif need == "event":
        if not body.eventId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Choose the event this certificate is for",
            )
        event = db.query(Event).filter(
            Event.id == parse_id(body.eventId, "event")
        ).first()
        if event is None:
            raise not_found("event")

        attended = (
            db.query(Registration)
            .filter(
                Registration.event_id == event.id,
                Registration.user_id == user.id,
                Registration.status == "confirmed",
            )
            .first()
        )
        if attended is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="We have no record of you taking part in that event",
            )
        event_id = event.id

    elif need == "reference":
        if not (body.referenceName and body.referencePhone):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A recommendation needs a reference name and phone number",
            )

    # One open request per type at a time, so the queue does not fill with
    # duplicates from an impatient volunteer.
    duplicate = (
        db.query(Certificate)
        .filter(
            Certificate.user_id == user.id,
            Certificate.type == body.type,
            Certificate.status == "pending",
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending request of this type",
        )

    cert = Certificate(
        user_id=user.id,
        type=body.type,
        purpose=body.purpose,
        event_id=event_id,
        reference_name=body.referenceName or "",
        reference_role=body.referenceRole or "",
        reference_phone=body.referencePhone or "",
        requested_at=date.today(),
        status="pending",
        note="",
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return _shape(cert, _verified_hours(db, user.id))


@router.patch("/{cert_id}/review", response_model=CertificateOut)
def review_certificate(
    cert_id: str,
    body: CertificateReview,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    cert = db.query(Certificate).filter(
        Certificate.id == parse_id(cert_id, "certificate")
    ).first()
    if cert is None:
        raise not_found("certificate")

    if cert.user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot approve your own certificate",
        )

    if cert.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This request was already {cert.status}",
        )

    cert.status = body.status
    cert.note = body.note or ""
    cert.reviewed_at = date.today()
    cert.reviewed_by_id = admin.id

    if body.status == "approved":
        cert.certificate_no = _next_certificate_no(db)
        cert.issued_at = date.today()

    db.commit()
    db.refresh(cert)
    return _shape(cert, _verified_hours(db, cert.user_id))
