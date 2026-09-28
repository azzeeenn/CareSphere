"""
CareSphere — add a veteran volunteer
=====================================

Adds ONE volunteer who meets every rule for becoming an admin, so the
full "volunteer -> admin" flow can be demonstrated. Nothing else in the
database is touched — unlike seed.py, this does not wipe anything.

Run it from the backend/ folder:

    python add_veteran.py

Safe to run twice: if she already exists, it stops.

    Kavya Rao    kavya.r@example.com    vol123

Her history is built relative to TODAY, so she keeps meeting the
"active in 9 of the last 12 months" rule no matter when this is run:

  * approved 2 years 6 months ago
  * 13 completed events over the last 12 months, across all three
    programme areas and several districts
  * signed up for every one, turned up to every one (100% attendance)
  * 8 verified hours at each  ->  104 hours
  * nothing ever rejected
"""

from datetime import date, datetime, timedelta

from app.database import SessionLocal
from app.security import hash_password
from app import models as m

EMAIL = "kavya.r@example.com"

# (title, category, district, venue)
EVENTS = [
    ("Reading circle, Jayanagar",        "Education",   "Bengaluru Urban", "Community Hall, Jayanagar"),
    ("Eye screening, Malavalli",         "Healthcare",  "Mandya",          "Govt Primary School, Malavalli"),
    ("Sapling drive, Kukkarahalli Lake", "Green Cover", "Mysuru",          "Kukkarahalli Lake"),
    ("Maths clinic, Hassan",             "Education",   "Hassan",          "DIET Campus, Hassan"),
    ("Blood donation camp, Kolar",       "Healthcare",  "Kolar",           "Town Hall, Kolar"),
    ("Roadside planting, Tumakuru",      "Green Cover", "Tumakuru",        "NH-48 service road"),
    ("Exam prep weekend, Mysuru",        "Education",   "Mysuru",          "Govt High School, Mysuru"),
    ("Dental check-up camp, Mandya",     "Healthcare",  "Mandya",          "PHC Mandya"),
    ("School garden build, Kolar",       "Green Cover", "Kolar",           "Zilla Parishad School, Kolar"),
    ("Library sorting day, Tumakuru",    "Education",   "Tumakuru",        "District Library"),
    ("BP & sugar screening, Hassan",     "Healthcare",  "Hassan",          "Market Square, Hassan"),
    ("Lake bund clean-up, Bengaluru",    "Green Cover", "Bengaluru Urban", "Agara Lake"),
    ("Storytelling session, Mandya",     "Education",   "Mandya",          "Anganwadi Centre"),
]


def months_ago(today: date, n: int, day: int = 12) -> date:
    y, mth = today.year, today.month - n
    while mth <= 0:
        mth += 12
        y -= 1
    return date(y, mth, min(day, 28))


def add_veteran(db):
    if db.query(m.User).filter(m.User.email == EMAIL).first():
        print(f"{EMAIL} already exists - nothing to do.")
        return

    today = date.today()
    cats = {c.name: c for c in db.query(m.Category).all()}
    dists = {d.name: d for d in db.query(m.District).all()}
    approver = db.query(m.User).filter(m.User.role == "super_admin").first()

    joined = months_ago(today, 31, 3)       # account created
    approved = months_ago(today, 30, 5)     # 2 years 6 months ago

    kavya = m.User(
        name="Kavya Rao", email=EMAIL, password_hash=hash_password("vol123"),
        role="volunteer", active=True, created_at=datetime.combine(joined, datetime.min.time()),
    )
    db.add(kavya)
    db.flush()

    db.add(m.Application(
        user_id=kavya.id, phone="98860 44120", city="Mysuru",
        district_id=dists["Mysuru"].id if "Mysuru" in dists else None,
        category_id=cats["Education"].id if "Education" in cats else None,
        availability="Both", hours_per_week=10,
        skills="Teaching, first aid, Kannada, English, event logistics",
        experience="Ran weekend tutoring for a housing colony for three years.",
        motivation="I want to help organise, not just turn up.",
        emergency_name="Sunil Rao", emergency_phone="98450 77120",
        status="approved", submitted_at=months_ago(today, 30, 1),
        reviewed_at=approved, reviewed_by_id=approver.id if approver else None, note="",
    ))

    # One event a month, from 12 months ago up to last month, plus one
    # extra earlier this month — 13 in all, 12 distinct months active.
    for i, (title, cat, dist, venue) in enumerate(EVENTS):
        when = months_ago(today, 12 - i, 9) if i < 12 else today - timedelta(days=2)
        if when >= today:
            when = today - timedelta(days=1)
        start = datetime.combine(when, datetime.min.time()).replace(hour=9)

        ev = m.Event(
            title=title, category_id=cats[cat].id if cat in cats else None,
            district_id=dists[dist].id if dist in dists else None, venue=venue,
            starts_at=start, ends_at=start.replace(hour=17), capacity=25,
            status="completed", description="Past event (demo history).",
            created_at=start - timedelta(days=21),
        )
        db.add(ev)
        db.flush()

        db.add(m.Registration(event_id=ev.id, user_id=kavya.id,
                              status="confirmed", registered_at=when - timedelta(days=7)))
        db.add(m.VolunteerHours(
            user_id=kavya.id, event_id=ev.id, hours=8, logged_at=when,
            status="verified", note="",
            verified_at=when + timedelta(days=1),
            verified_by_id=approver.id if approver else None,
        ))

    db.commit()
    print("Added Kavya Rao (kavya.r@example.com / vol123)")
    print("  approved:", approved, "| 13 events | 104 verified hours | 100% attendance")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        add_veteran(db)
    finally:
        db.close()
