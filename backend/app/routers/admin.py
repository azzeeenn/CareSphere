"""
CareSphere — operations and administration
===========================================

Donations, contact messages, partnership enquiries, impact numbers,
organisation settings and admin user management.

The role split matches the admin panel:

    Super admin only   donations, impact numbers, settings, admin users,
                       and every delete
    Any admin          messages, partnerships — the day-to-day work

Contact and partnership forms accept public submissions, because someone
enquiring about a partnership obviously has no account. Everything else
requires a login.
"""

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin, require_super_admin
from ..database import get_db
from ..models import (
    Donation,
    ImpactStat,
    Message as ContactMessage,
    Partnership,
    Settings,
    User,
)
from ..schemas import (
    AdminUserCreate,
    AdminUserUpdate,
    ContactCreate,
    ContactOut,
    ContactUpdate,
    DonationCreate,
    DonationOut,
    DonationUpdate,
    ImpactCreate,
    ImpactOut,
    ImpactUpdate,
    PartnershipCreate,
    PartnershipOut,
    PartnershipUpdate,
    SettingsOut,
    SettingsUpdate,
    UserOut,
)
from ..security import hash_password
from .common import not_found, parse_id

donation_router = APIRouter(prefix="/api/donations", tags=["donations"])
contact_router = APIRouter(prefix="/api/messages", tags=["messages"])
partnership_router = APIRouter(prefix="/api/partnerships", tags=["partnerships"])
impact_router = APIRouter(prefix="/api/impact", tags=["impact"])
settings_router = APIRouter(prefix="/api/settings", tags=["settings"])
user_router = APIRouter(prefix="/api/users", tags=["users"])


def _assignee_id(db: Session, raw: Optional[str]) -> Optional[int]:
    """Turn an assignedTo user id string into an int, checking it exists."""
    if raw in (None, ""):
        return None
    staff = db.query(User).filter(User.id == parse_id(raw, "user")).first()
    if staff is None or staff.role not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only assign to an admin",
        )
    return staff.id


# ===========================================================================
#  DONATIONS  — super admin only, including reads
# ===========================================================================


def _shape_donation(d: Donation) -> DonationOut:
    return DonationOut(
        id=d.id, donor=d.donor, amount=float(d.amount), mode=d.mode,
        purpose=d.purpose, date=d.date, status=d.status,
        receiptNo=d.receipt_no or "",
    )


@donation_router.get("", response_model=List[DonationOut])
def list_donations(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
    status_: Optional[str] = Query(None, alias="status"),
):
    q = db.query(Donation)
    if status_:
        q = q.filter(Donation.status == status_)
    return [_shape_donation(d) for d in q.order_by(Donation.date.desc()).all()]


@donation_router.get("/summary")
def donation_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """
    Totals for the dashboard. Computed in SQL rather than by adding up
    rows in JavaScript, which is both faster and correct when the list
    grows past what a page loads.
    """
    def total(status_value: Optional[str] = None) -> float:
        q = db.query(func.coalesce(func.sum(Donation.amount), 0))
        if status_value:
            q = q.filter(Donation.status == status_value)
        return float(q.scalar() or 0)

    by_purpose = (
        db.query(Donation.purpose, func.coalesce(func.sum(Donation.amount), 0))
        .group_by(Donation.purpose)
        .all()
    )

    return {
        "total": total(),
        "verified": total("verified"),
        "pending": total("pending"),
        "count": db.query(func.count(Donation.id)).scalar(),
        "byPurpose": {p or "Unspecified": float(a) for p, a in by_purpose},
    }


@donation_router.post("", response_model=DonationOut, status_code=201)
def record_donation(
    body: DonationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = Donation(
        donor=body.donor, amount=body.amount, mode=body.mode,
        purpose=body.purpose, date=body.date or date.today(),
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _shape_donation(row)


@donation_router.patch("/{donation_id}", response_model=DonationOut)
def update_donation(
    donation_id: str,
    body: DonationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(Donation).filter(
        Donation.id == parse_id(donation_id, "donation")
    ).first()
    if row is None:
        raise not_found("donation")

    changes = body.model_dump(exclude_unset=True)

    # Verifying issues the receipt number, once.
    if changes.get("status") == "verified" and not row.receipt_no:
        row.receipt_no = _next_receipt_no(db)

    for field, value in changes.items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    return _shape_donation(row)


def _next_receipt_no(db: Session) -> str:
    """CS-<year>-<4 digits>, matching the format already in your data."""
    year = date.today().year
    prefix = f"CS-{year}-"
    rows = db.query(Donation.receipt_no).filter(
        Donation.receipt_no.like(f"{prefix}%")
    ).all()

    highest = 0
    for (value,) in rows:
        try:
            highest = max(highest, int(value.rsplit("-", 1)[1]))
        except (ValueError, IndexError, AttributeError):
            continue

    return f"{prefix}{highest + 1:04d}"


@donation_router.delete("/{donation_id}", status_code=204)
def delete_donation(
    donation_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(Donation).filter(
        Donation.id == parse_id(donation_id, "donation")
    ).first()
    if row is None:
        raise not_found("donation")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


# ===========================================================================
#  CONTACT MESSAGES
# ===========================================================================


def _shape_contact(m: ContactMessage) -> ContactOut:
    return ContactOut(
        id=m.id, name=m.name, email=m.email, subject=m.subject, body=m.body,
        receivedAt=m.received_at, status=m.status,
        assignedTo=m.assigned_to.name if m.assigned_to else "",
        notes=m.notes or "",
    )


@contact_router.get("", response_model=List[ContactOut])
def list_messages(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
    status_: Optional[str] = Query(None, alias="status"),
):
    q = db.query(ContactMessage)
    if status_:
        q = q.filter(ContactMessage.status == status_)
    return [_shape_contact(m) for m in q.order_by(ContactMessage.received_at.desc()).all()]


@contact_router.post("", response_model=ContactOut, status_code=201)
def send_message(body: ContactCreate, db: Session = Depends(get_db)):
    """Public contact form."""
    row = ContactMessage(
        name=body.name.strip(),
        email=str(body.email).lower(),
        subject=body.subject,
        body=body.body.strip(),
        received_at=date.today(),
        status="new",
        notes="",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _shape_contact(row)


@contact_router.patch("/{msg_id}", response_model=ContactOut)
def update_message(
    msg_id: str,
    body: ContactUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = db.query(ContactMessage).filter(
        ContactMessage.id == parse_id(msg_id, "message")
    ).first()
    if row is None:
        raise not_found("message")

    changes = body.model_dump(exclude_unset=True)
    if "assignedTo" in changes:
        row.assigned_to_id = _assignee_id(db, changes.pop("assignedTo"))
    for field, value in changes.items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    return _shape_contact(row)


@contact_router.delete("/{msg_id}", status_code=204)
def delete_message(
    msg_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(ContactMessage).filter(
        ContactMessage.id == parse_id(msg_id, "message")
    ).first()
    if row is None:
        raise not_found("message")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


# ===========================================================================
#  PARTNERSHIPS
# ===========================================================================


def _shape_partnership(p: Partnership) -> PartnershipOut:
    return PartnershipOut(
        id=p.id, institutionName=p.institution_name, type=p.type,
        contactName=p.contact_name, contactRole=p.contact_role,
        email=p.email, phone=p.phone, location=p.location,
        childCount=p.child_count, message=p.message,
        receivedAt=p.received_at, status=p.status,
        assignedTo=p.assigned_to.name if p.assigned_to else "",
        notes=p.notes or "",
    )


@partnership_router.get("", response_model=List[PartnershipOut])
def list_partnerships(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
    status_: Optional[str] = Query(None, alias="status"),
):
    q = db.query(Partnership)
    if status_:
        q = q.filter(Partnership.status == status_)
    return [_shape_partnership(p) for p in q.order_by(Partnership.received_at.desc()).all()]


@partnership_router.post("", response_model=PartnershipOut, status_code=201)
def submit_partnership(body: PartnershipCreate, db: Session = Depends(get_db)):
    """Public enquiry form — schools and colleges have no accounts."""
    row = Partnership(
        institution_name=body.institutionName.strip(),
        type=body.type,
        contact_name=body.contactName,
        contact_role=body.contactRole,
        email=str(body.email).lower() if body.email else None,
        phone=body.phone,
        location=body.location,
        child_count=body.childCount,
        message=body.message,
        received_at=date.today(),
        status="new",
        notes="",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _shape_partnership(row)


@partnership_router.patch("/{item_id}", response_model=PartnershipOut)
def update_partnership(
    item_id: str,
    body: PartnershipUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = db.query(Partnership).filter(
        Partnership.id == parse_id(item_id, "enquiry")
    ).first()
    if row is None:
        raise not_found("enquiry")

    changes = body.model_dump(exclude_unset=True)
    if "assignedTo" in changes:
        row.assigned_to_id = _assignee_id(db, changes.pop("assignedTo"))
    for field, value in changes.items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    return _shape_partnership(row)


@partnership_router.delete("/{item_id}", status_code=204)
def delete_partnership(
    item_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(Partnership).filter(
        Partnership.id == parse_id(item_id, "enquiry")
    ).first()
    if row is None:
        raise not_found("enquiry")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


# ===========================================================================
#  IMPACT NUMBERS  — public to read, super admin to change
# ===========================================================================


def _shape_impact(i: ImpactStat) -> ImpactOut:
    return ImpactOut(
        id=i.id, label=i.label, value=i.value,
        display_order=i.display_order, updatedAt=i.updated_at,
    )


@impact_router.get("", response_model=List[ImpactOut])
def list_impact(db: Session = Depends(get_db)):
    rows = db.query(ImpactStat).order_by(ImpactStat.display_order).all()
    return [_shape_impact(i) for i in rows]


@impact_router.post("", response_model=ImpactOut, status_code=201)
def create_impact(
    body: ImpactCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = ImpactStat(
        label=body.label, value=body.value,
        display_order=body.order, updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _shape_impact(row)


@impact_router.patch("/{item_id}", response_model=ImpactOut)
def update_impact(
    item_id: str,
    body: ImpactUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(ImpactStat).filter(
        ImpactStat.id == parse_id(item_id, "figure")
    ).first()
    if row is None:
        raise not_found("figure")

    changes = body.model_dump(exclude_unset=True)
    if "order" in changes:
        row.display_order = changes.pop("order")
    for field, value in changes.items():
        setattr(row, field, value)
    row.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    return _shape_impact(row)


@impact_router.delete("/{item_id}", status_code=204)
def delete_impact(
    item_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(ImpactStat).filter(
        ImpactStat.id == parse_id(item_id, "figure")
    ).first()
    if row is None:
        raise not_found("figure")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


# ===========================================================================
#  SETTINGS  — one row, public to read (the footer needs it)
# ===========================================================================


@settings_router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    row = db.query(Settings).filter(Settings.id == 1).first()
    if row is None:
        raise not_found("settings")
    return row


@settings_router.patch("", response_model=SettingsOut)
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(Settings).filter(Settings.id == 1).first()
    if row is None:
        raise not_found("settings")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    return row


# ===========================================================================
#  ADMIN USER MANAGEMENT  — super admin only
# ===========================================================================


@user_router.get("", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
    role: Optional[str] = None,
):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    return q.order_by(User.created_at.desc()).all()


@user_router.get("/staff", response_model=List[UserOut])
def list_staff(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """
    Just the admins. Any admin can read this, because the assignee
    dropdown on messages and partnerships needs it.
    """
    return (
        db.query(User)
        .filter(User.role.in_(["admin", "super_admin"]), User.active == True)  # noqa: E712
        .order_by(User.name)
        .all()
    )


@user_router.post("", response_model=UserOut, status_code=201)
def create_user(
    body: AdminUserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    email = body.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        )

    row = User(
        name=body.name.strip(), email=email,
        password_hash=hash_password(body.password),
        role=body.role, active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@user_router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: AdminUserUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(require_super_admin),
):
    row = db.query(User).filter(User.id == parse_id(user_id, "user")).first()
    if row is None:
        raise not_found("user")

    changes = body.model_dump(exclude_unset=True)

    # Guard against locking yourself out: a super admin cannot demote or
    # deactivate their own account. Another super admin has to do it.
    if row.id == me.id:
        if changes.get("role") not in (None, "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot change your own role",
            )
        if changes.get("active") is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own account",
            )

    if "password" in changes:
        row.password_hash = hash_password(changes.pop("password"))

    for field, value in changes.items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    return row


@user_router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    me: User = Depends(require_super_admin),
):
    row = db.query(User).filter(User.id == parse_id(user_id, "user")).first()
    if row is None:
        raise not_found("user")

    if row.id == me.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )

    db.delete(row)
    db.commit()
    return Response(status_code=204)
