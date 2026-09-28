"""
CareSphere — becoming an admin
===============================

How a volunteer becomes an admin, start to finish:

  1. ELIGIBILITY   Their record is checked against seven rules, all
                   counted from the database — nothing is self-declared:

                     years as an approved volunteer
                     total verified hours
                     events worked (with verified hours)
                     programme areas covered
                     months active out of the last 12
                     attendance: turned up to events they signed up for
                     clean record: no logged hours ever rejected

  2. APPLY         Only possible when every rule passes, and only one
                   request at a time. The server re-checks the rules, so
                   the page cannot be bypassed.

  3. ENDORSE       Current admins vouch for them. Each admin once.

  4. INTERVIEW     A Super Admin records interview notes.

  5. DECIDE        A Super Admin approves or rejects. Approval needs the
                   endorsements (not counting the approver's own) and the
                   interview, and the rules are checked one last time.
                   Approving turns the account into an admin account.
                   Rejecting needs a written reason the volunteer sees.

The thresholds live in the promotion_rules table and a Super Admin can
change them from the Admin Requests page.

Routes (all under /api/admin-requests):

  GET    /rules                 anyone signed in
  PATCH  /rules                 super admin
  GET    /eligibility/me        volunteer — their checklist
  GET    /me                    volunteer — their requests
  POST   ""                     volunteer — apply
  GET    ""                     admin     — every request, with checklist
  POST   /{id}/endorse          admin
  PATCH  /{id}/interview        super admin
  PATCH  /{id}/review           super admin — approve / reject
"""

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    AdminEndorsement,
    AdminRequest,
    Application,
    Category,
    Event,
    PromotionRules,
    Registration,
    User,
    VolunteerHours,
)
from .common import not_found, parse_id

router = APIRouter(prefix="/api/admin-requests", tags=["admin requests"])

_bearer = HTTPBearer(auto_error=False)


# ===========================================================================
#  Who is asking
# ===========================================================================


def current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status_code=401, detail="Please sign in")
    try:
        from jose import jwt
        from ..config import ALGORITHM, SECRET_KEY

        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user = db.query(User).filter(User.id == int(payload.get("sub", 0))).first()
    except Exception:
        user = None
    if user is None or not user.active:
        raise HTTPException(status_code=401, detail="Please sign in again")
    return user


def volunteer_only(user: User = Depends(current_user)) -> User:
    if user.role != "volunteer":
        raise HTTPException(status_code=403, detail="Only volunteers can apply")
    return user


def staff_only(user: User = Depends(current_user)) -> User:
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admins only")
    return user


def super_only(user: User = Depends(current_user)) -> User:
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only a Super Admin can do this")
    return user


# ===========================================================================
#  Rules
# ===========================================================================


class RulesOut(BaseModel):
    minYears: int
    minHours: int
    minEvents: int
    minAreas: int
    minActiveMonths: int
    minAttendancePct: int
    minEndorsements: int


class RulesUpdate(BaseModel):
    minYears: Optional[int] = Field(default=None, ge=0, le=20)
    minHours: Optional[int] = Field(default=None, ge=0, le=10000)
    minEvents: Optional[int] = Field(default=None, ge=0, le=1000)
    minAreas: Optional[int] = Field(default=None, ge=0, le=10)
    minActiveMonths: Optional[int] = Field(default=None, ge=0, le=12)
    minAttendancePct: Optional[int] = Field(default=None, ge=0, le=100)
    minEndorsements: Optional[int] = Field(default=None, ge=0, le=10)


RULE_FIELDS = {
    "minYears": "min_years",
    "minHours": "min_hours",
    "minEvents": "min_events",
    "minAreas": "min_areas",
    "minActiveMonths": "min_active_months",
    "minAttendancePct": "min_attendance_pct",
    "minEndorsements": "min_endorsements",
}


def get_rules(db: Session) -> PromotionRules:
    """The one rules row, created with the defaults the first time."""
    rules = db.query(PromotionRules).filter(PromotionRules.id == 1).first()
    if rules is None:
        rules = PromotionRules(id=1)
        db.add(rules)
        db.commit()
        db.refresh(rules)
    return rules


def shape_rules(r: PromotionRules) -> RulesOut:
    return RulesOut(**{api: getattr(r, col) for api, col in RULE_FIELDS.items()})


@router.get("/rules", response_model=RulesOut)
def read_rules(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return shape_rules(get_rules(db))


@router.patch("/rules", response_model=RulesOut)
def update_rules(
    body: RulesUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(super_only),
):
    rules = get_rules(db)
    for api, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(rules, RULE_FIELDS[api], value)
    db.commit()
    db.refresh(rules)
    return shape_rules(rules)


# ===========================================================================
#  Eligibility — the seven checks
# ===========================================================================


def _months_between(start: date, end: date) -> int:
    """Whole months from start to end. 15 Mar 2024 -> 28 Sep 2026 = 30."""
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(months, 0)


def _years_text(months: int) -> str:
    y, m = divmod(months, 12)
    parts = []
    if y:
        parts.append(f"{y} year" + ("s" if y != 1 else ""))
    if m or not y:
        parts.append(f"{m} month" + ("s" if m != 1 else ""))
    return " ".join(parts)


def _last_12_months(today: date):
    out = []
    y, m = today.year, today.month
    for _ in range(12):
        out.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return set(out)


def check_eligibility(db: Session, user: User, rules: PromotionRules) -> dict:
    """
    Every figure below is counted from existing rows. Returns the list of
    checks (each with what they have, what is needed, and pass/fail) and
    an overall verdict.
    """
    today = date.today()
    now = datetime.utcnow()
    checks = []

    def add(key, label, have, need, passed, detail):
        checks.append({
            "key": key, "label": label, "have": have, "need": need,
            "passed": bool(passed), "detail": detail,
        })

    # 1. Years as an approved volunteer ------------------------------------
    app = db.query(Application).filter(Application.user_id == user.id).first()
    since = None
    if app and app.status == "approved":
        since = app.reviewed_at or app.submitted_at
    months = _months_between(since, today) if since else 0
    add("years", "Volunteering for long enough",
        round(months / 12, 1), rules.min_years,
        since is not None and months >= rules.min_years * 12,
        (f"{_years_text(months)} since approval "
         f"(needs {rules.min_years} year{'s' if rules.min_years != 1 else ''})")
        if since else "Your volunteer application isn't approved yet")

    # Verified hours drive checks 2-5 ---------------------------------------
    verified = (
        db.query(VolunteerHours)
        .filter(VolunteerHours.user_id == user.id,
                VolunteerHours.status == "verified")
        .all()
    )

    # 2. Total verified hours ------------------------------------------------
    total = round(sum(float(h.hours) for h in verified), 1)
    add("hours", "Verified hours", total, rules.min_hours,
        total >= rules.min_hours,
        f"{total:g} of {rules.min_hours} hours verified by an organiser")

    # 3. Events worked -------------------------------------------------------
    event_ids = {h.event_id for h in verified if h.event_id}
    add("events", "Events worked", len(event_ids), rules.min_events,
        len(event_ids) >= rules.min_events,
        f"{len(event_ids)} of {rules.min_events} events with verified hours")

    # 4. Programme areas -----------------------------------------------------
    area_names = set()
    if event_ids:
        rows = (
            db.query(Category.name)
            .join(Event, Event.category_id == Category.id)
            .filter(Event.id.in_(event_ids))
            .distinct()
            .all()
        )
        area_names = {r[0] for r in rows}
    all_areas = db.query(Category).count()
    need_areas = min(rules.min_areas, all_areas) if all_areas else rules.min_areas
    add("areas", "Programme areas covered", len(area_names), need_areas,
        len(area_names) >= need_areas,
        (", ".join(sorted(area_names)) if area_names else "None yet")
        + f" ({len(area_names)} of {need_areas})")

    # 5. Steady commitment: active months in the last 12 ---------------------
    window = _last_12_months(today)
    active = {
        (h.logged_at.year, h.logged_at.month)
        for h in verified if h.logged_at
    } & window
    add("active", "Active month after month", len(active), rules.min_active_months,
        len(active) >= rules.min_active_months,
        f"Verified hours in {len(active)} of the last 12 months "
        f"(needs {rules.min_active_months})")

    # 6. Reliability: turned up to what they signed up for -------------------
    past_regs = (
        db.query(Registration)
        .join(Event, Event.id == Registration.event_id)
        .filter(Registration.user_id == user.id,
                Registration.status == "confirmed",
                Event.starts_at < now)
        .all()
    )
    signed_up = {r.event_id for r in past_regs}
    turned_up = signed_up & event_ids
    pct = round(100 * len(turned_up) / len(signed_up)) if signed_up else 0
    add("attendance", "Turns up when signed up", pct, rules.min_attendance_pct,
        bool(signed_up) and pct >= rules.min_attendance_pct,
        (f"Turned up to {len(turned_up)} of {len(signed_up)} events signed up for ({pct}%)")
        if signed_up else "No past event sign-ups to measure yet")

    # 7. Clean record ---------------------------------------------------------
    rejected = (
        db.query(VolunteerHours)
        .filter(VolunteerHours.user_id == user.id,
                VolunteerHours.status == "rejected")
        .count()
    )
    add("clean", "Clean record", rejected, 0, rejected == 0,
        "No logged hours ever rejected" if rejected == 0
        else f"{rejected} logged {'entry' if rejected == 1 else 'entries'} rejected")

    return {
        "eligible": all(c["passed"] for c in checks),
        "passed": sum(1 for c in checks if c["passed"]),
        "total": len(checks),
        "checks": checks,
    }


# ===========================================================================
#  Shapes
# ===========================================================================


class RequestCreate(BaseModel):
    motivation: str = Field(min_length=80, max_length=3000)
    achievements: str = Field(min_length=40, max_length=3000)
    rolesHeld: str = Field(min_length=20, max_length=2000)
    hoursPerWeek: int = Field(ge=2, le=60)
    preferredArea: Optional[str] = Field(default=None, max_length=60)


class EndorseBody(BaseModel):
    comment: str = Field(min_length=20, max_length=1000)


class InterviewBody(BaseModel):
    notes: str = Field(min_length=30, max_length=5000)


class ReviewBody(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    note: Optional[str] = Field(default="", max_length=2000)


def _iso(dt):
    return dt.isoformat() if dt else None


def shape_request(db: Session, r: AdminRequest, rules: PromotionRules,
                  with_record: bool) -> dict:
    out = {
        "_id": str(r.id),
        "userId": str(r.user_id),
        "name": r.user.name if r.user else None,
        "email": r.user.email if r.user else None,
        "motivation": r.motivation,
        "achievements": r.achievements,
        "rolesHeld": r.roles_held,
        "hoursPerWeek": r.hours_per_week,
        "preferredArea": r.preferred_area,
        "status": r.status,
        "submittedAt": _iso(r.submitted_at),
        "interviewNotes": r.interview_notes,
        "interviewedAt": _iso(r.interviewed_at),
        "interviewedBy": r.interviewed_by.name if r.interviewed_by else None,
        "reviewedAt": _iso(r.reviewed_at),
        "reviewedBy": r.reviewed_by.name if r.reviewed_by else None,
        "decisionNote": r.decision_note or "",
        "endorsements": [
            {
                "adminId": str(e.admin_id),
                "adminName": e.admin.name if e.admin else "An admin",
                "comment": e.comment or "",
                "createdAt": _iso(e.created_at),
            }
            for e in sorted(r.endorsements, key=lambda e: e.created_at or datetime.min)
        ],
        "endorsementsNeeded": rules.min_endorsements,
    }
    # The volunteer sees their own answers and the outcome. Admins also see
    # the live record check, so the decision rests on facts.
    if with_record and r.user:
        out["record"] = check_eligibility(db, r.user, rules)
    return out


def _load(db: Session, request_id: str) -> AdminRequest:
    row = db.query(AdminRequest).filter(
        AdminRequest.id == parse_id(request_id, "request")
    ).first()
    if row is None:
        raise not_found("request")
    return row


# ===========================================================================
#  Volunteer routes
# ===========================================================================


@router.get("/eligibility/me")
def my_eligibility(db: Session = Depends(get_db), me: User = Depends(volunteer_only)):
    rules = get_rules(db)
    result = check_eligibility(db, me, rules)
    pending = db.query(AdminRequest).filter(
        AdminRequest.user_id == me.id, AdminRequest.status == "pending"
    ).first()
    result["hasPending"] = pending is not None
    result["canApply"] = result["eligible"] and pending is None
    result["rules"] = shape_rules(rules).model_dump()
    return result


@router.get("/me")
def my_requests(db: Session = Depends(get_db), me: User = Depends(volunteer_only)):
    rules = get_rules(db)
    rows = (
        db.query(AdminRequest)
        .filter(AdminRequest.user_id == me.id)
        .order_by(AdminRequest.submitted_at.desc())
        .all()
    )
    out = []
    for r in rows:
        shaped = shape_request(db, r, rules, with_record=False)
        # Volunteers see how many endorsements, not the private comments,
        # and not the interview notes.
        shaped["endorsementCount"] = len(shaped.pop("endorsements"))
        shaped.pop("interviewNotes", None)
        out.append(shaped)
    return out


@router.post("", status_code=201)
def apply(
    body: RequestCreate,
    db: Session = Depends(get_db),
    me: User = Depends(volunteer_only),
):
    rules = get_rules(db)

    if db.query(AdminRequest).filter(
        AdminRequest.user_id == me.id, AdminRequest.status == "pending"
    ).first():
        raise HTTPException(status_code=409,
                            detail="You already have a request waiting for a decision")

    # The page hides the form when a rule fails, but the rule is enforced
    # here — calling the API directly gets the same answer.
    result = check_eligibility(db, me, rules)
    if not result["eligible"]:
        failing = [c["label"] for c in result["checks"] if not c["passed"]]
        raise HTTPException(
            status_code=403,
            detail="Not eligible yet. Still needed: " + "; ".join(failing),
        )

    row = AdminRequest(
        user_id=me.id,
        motivation=body.motivation.strip(),
        achievements=body.achievements.strip(),
        roles_held=body.rolesHeld.strip(),
        hours_per_week=body.hoursPerWeek,
        preferred_area=(body.preferredArea or "").strip() or None,
        status="pending",
        submitted_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return shape_request(db, row, rules, with_record=False)


# ===========================================================================
#  Admin routes
# ===========================================================================


@router.get("")
def list_requests(db: Session = Depends(get_db), _: User = Depends(staff_only)):
    rules = get_rules(db)
    rows = db.query(AdminRequest).order_by(AdminRequest.submitted_at.desc()).all()
    return [shape_request(db, r, rules, with_record=True) for r in rows]


@router.post("/{request_id}/endorse")
def endorse(
    request_id: str,
    body: EndorseBody,
    db: Session = Depends(get_db),
    me: User = Depends(staff_only),
):
    row = _load(db, request_id)
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="This request has already been decided")
    if any(e.admin_id == me.id for e in row.endorsements):
        raise HTTPException(status_code=409, detail="You've already endorsed this request")

    db.add(AdminEndorsement(request_id=row.id, admin_id=me.id,
                            comment=body.comment.strip()))
    db.commit()
    db.refresh(row)
    return shape_request(db, row, get_rules(db), with_record=True)


@router.patch("/{request_id}/interview")
def record_interview(
    request_id: str,
    body: InterviewBody,
    db: Session = Depends(get_db),
    me: User = Depends(super_only),
):
    row = _load(db, request_id)
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="This request has already been decided")

    row.interview_notes = body.notes.strip()
    row.interviewed_at = datetime.utcnow()
    row.interviewed_by_id = me.id
    db.commit()
    db.refresh(row)
    return shape_request(db, row, get_rules(db), with_record=True)


@router.patch("/{request_id}/review")
def review(
    request_id: str,
    body: ReviewBody,
    db: Session = Depends(get_db),
    me: User = Depends(super_only),
):
    rules = get_rules(db)
    row = _load(db, request_id)
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="This request has already been decided")

    if body.status == "rejected":
        if not body.note or len(body.note.strip()) < 10:
            raise HTTPException(status_code=422,
                                detail="Give the volunteer a reason (at least a sentence)")
    else:
        # Approval: every safeguard, checked here and not only on the page.
        others = {e.admin_id for e in row.endorsements if e.admin_id != me.id}
        if len(others) < rules.min_endorsements:
            raise HTTPException(
                status_code=422,
                detail=(f"Needs {rules.min_endorsements} endorsements from other admins "
                        f"(has {len(others)}). Your own endorsement doesn't count "
                        f"towards a request you approve."),
            )
        if not row.interview_notes:
            raise HTTPException(status_code=422,
                                detail="Record the interview notes before approving")

        record = check_eligibility(db, row.user, rules)
        if not record["eligible"]:
            failing = [c["label"] for c in record["checks"] if not c["passed"]]
            raise HTTPException(
                status_code=422,
                detail="Their record no longer meets the rules: " + "; ".join(failing),
            )

        if row.user.role != "volunteer" or not row.user.active:
            raise HTTPException(status_code=422,
                                detail="This account is no longer an active volunteer")

        row.user.role = "admin"

    row.status = body.status
    row.decision_note = (body.note or "").strip()
    row.reviewed_at = datetime.utcnow()
    row.reviewed_by_id = me.id
    db.commit()
    db.refresh(row)
    return shape_request(db, row, rules, with_record=True)
