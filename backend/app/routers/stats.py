"""
CareSphere — live impact figures
=================================

GET /api/stats   (public, no login)

The figures the database can count for itself, so nobody has to type
them in and nobody can type in a wrong one:

    Active volunteers   approved, active volunteer accounts
    Events held         completed events, plus published ones already past
    Hours given         total VERIFIED volunteer hours
    Funds raised        total of VERIFIED donations

Plus the data behind the three charts on the impact dashboard.

Figures the system cannot know (trees planted, beneficiaries reached)
stay in the Impact Numbers table, typed in by an admin.

Everything here is a count or a sum over existing rows — nothing is
stored, so it can never drift out of step with the records.
"""

from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application, Donation, Event, User, VolunteerHours

stats_router = APIRouter(prefix="/api/stats", tags=["stats"])

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def last_six_months(today: date):
    """[(2026, 4), (2026, 5), ... (2026, 9)] — oldest first, this month last."""
    months = []
    y, m = today.year, today.month
    for _ in range(6):
        months.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(months))


def label(ym):
    return MONTH_NAMES[ym[1] - 1]


@stats_router.get("")
def live_stats(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    months = last_six_months(now.date())

    # --- Active volunteers ------------------------------------------------
    approved = (
        db.query(Application)
        .join(User, User.id == Application.user_id)
        .filter(
            Application.status == "approved",
            User.role == "volunteer",
            User.active.is_(True),
        )
        .all()
    )

    # --- Events held --------------------------------------------------------
    held_events = (
        db.query(Event)
        .filter(
            (Event.status == "completed")
            | ((Event.status == "published") & (Event.starts_at < now))
        )
        .all()
    )

    # --- Verified hours -------------------------------------------------------
    hours_total = (
        db.query(func.coalesce(func.sum(VolunteerHours.hours), 0))
        .filter(VolunteerHours.status == "verified")
        .scalar()
    )

    # --- Verified donations ---------------------------------------------------
    donations = db.query(Donation).filter(Donation.status == "verified").all()
    funds_total = sum(float(d.amount) for d in donations)

    # --- Chart: verified donations per month ---------------------------------
    per_month = {ym: 0.0 for ym in months}
    for d in donations:
        if d.date and (d.date.year, d.date.month) in per_month:
            per_month[(d.date.year, d.date.month)] += float(d.amount)

    # --- Chart: running total of approved volunteers -------------------------
    # Counted by the date each application was approved. Older rows with no
    # review date fall back to when they were submitted.
    approval_dates = [a.reviewed_at or a.submitted_at for a in approved]
    volunteer_totals = []
    for (y, m) in months:
        # last day of that month = first day of the next, minus nothing:
        # anything approved before the 1st of the following month counts.
        ny, nm = (y + 1, 1) if m == 12 else (y, m + 1)
        cutoff = date(ny, nm, 1)
        volunteer_totals.append(
            sum(1 for d in approval_dates if d and d < cutoff)
        )

    # --- Chart: events by programme area -------------------------------------
    by_area = {}
    for e in db.query(Event).filter(Event.status.in_(["published", "completed"])).all():
        name = e.category.name if e.category else "Other"
        by_area[name] = by_area.get(name, 0) + 1

    return {
        "updatedAt": now,
        "figures": [
            {"key": "volunteers", "label": "Active volunteers",
             "value": len(approved)},
            {"key": "events", "label": "Events held",
             "value": len(held_events)},
            {"key": "hours", "label": "Volunteer hours given",
             "value": round(float(hours_total))},
            {"key": "funds", "label": "Funds raised",
             "value": round(funds_total), "prefix": "₹"},
        ],
        "charts": {
            "funds": {
                "labels": [label(ym) for ym in months],
                "values": [round(per_month[ym]) for ym in months],
            },
            "volunteers": {
                "labels": [label(ym) for ym in months],
                "values": volunteer_totals,
            },
            "areas": {
                "labels": list(by_area.keys()),
                "values": list(by_area.values()),
            },
        },
    }
