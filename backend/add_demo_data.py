"""
CareSphere: fill the site with realistic sample data
=====================================================

The pages now show real database figures instead of typed-in numbers,
so a database with 8 volunteers makes the whole site look empty. This
adds a believable amount of activity, spread over the last 2.5 years
and the next 3 months:

    ~200 volunteers     most approved, some pending, some asked for
                        more information, a few rejected, a few who
                        signed up but never applied
    ~55 events          past (completed), upcoming, a couple of drafts
                        and one cancelled, across all 6 districts
    registrations       people signing up for events (one upcoming
                        event is full, so the waitlist shows)
    volunteer hours     for people who turned up: mostly verified,
                        recent ones still pending, a handful rejected
    donations           ~120 over the last year, mostly verified
    testimonials        from volunteers: approved, featured, pending
    news                published articles and a couple of drafts
    messages, partnerships, newsletter subscribers, certificate
    requests, and Hall of Fame entries linked to top volunteers

Nothing already in the database is changed or deleted.

Run it from the backend/ folder:

    python add_demo_data.py

Safe to run twice: if the sample volunteers are already there it stops.
The same "random" data comes out every time (fixed seed), and all dates
are worked out from TODAY, so the site always looks current.

Every sample volunteer's password is:  vol123
Their emails end in  @volunteers.example.com
"""

import random
from datetime import date, datetime, timedelta

from app.database import SessionLocal
from app.security import hash_password
from app import models as m

DOMAIN = "volunteers.example.com"
rng = random.Random(2026)

FIRST = [
    "Aarav", "Aditi", "Akash", "Ananya", "Anil", "Anjali", "Arjun", "Asha", "Bhavya", "Chaitra",
    "Deepa", "Deepak", "Divya", "Farhan", "Gayathri", "Ganesh", "Harsha", "Hema", "Imran", "Ishaan",
    "Jyothi", "Karthik", "Kavitha", "Kiran", "Lavanya", "Madhu", "Manjunath", "Meghana", "Mohammed", "Nandini",
    "Naveen", "Nisha", "Pavan", "Pooja", "Pradeep", "Prakash", "Priyanka", "Rahul", "Ramya", "Ravi",
    "Rekha", "Rohan", "Sahana", "Sameer", "Sandhya", "Sanjay", "Shreya", "Shruti", "Sneha", "Sowmya",
    "Srinivas", "Suresh", "Swathi", "Tanvi", "Tejas", "Uma", "Varun", "Vidya", "Vinay", "Yash",
    "Zoya", "Ayesha", "Rizwan", "Sara", "Joseph", "Mary", "Thomas", "Anita", "Vikram", "Keerthi",
]
LAST = [
    "Rao", "Gowda", "Shetty", "Hegde", "Nayak", "Kumar", "Reddy", "Iyer", "Bhat", "Kamath",
    "Pai", "Naik", "Patil", "Kulkarni", "Joshi", "Menon", "Nair", "Khan", "Sheikh", "Fernandes",
    "D'Souza", "Prasad", "Murthy", "Swamy", "Acharya", "Shenoy", "Poojary", "Salian", "Devi", "Sharma",
]

EVENT_TEMPLATES = {
    "Education": [
        ("Weekend reading circle", "Storytelling and reading practice for children aged 6 to 11."),
        ("Maths clinic", "Small-group help with homework and exam practice for classes 6 to 9."),
        ("Spoken English session", "Conversation practice for secondary school students."),
        ("School supplies distribution", "Notebooks, bags and stationery for government school students."),
        ("Library sorting day", "Cataloguing donated books for a school library."),
        ("Exam prep weekend", "Revision sessions ahead of board exams."),
        ("Digital literacy class", "Basic computer and phone skills for teenagers."),
    ],
    "Healthcare": [
        ("Free eye screening camp", "Screening and free spectacles, run with a partner hospital."),
        ("Blood donation drive", "Donation camp with the district blood bank."),
        ("BP and sugar screening", "Check-ups for adults over 40, with referral where needed."),
        ("Dental check-up camp", "Free dental check-ups for schoolchildren."),
        ("Nutrition awareness talk", "Session on balanced meals for mothers and young children."),
        ("First aid training", "Hands-on first aid basics for community volunteers."),
    ],
    "Green Cover": [
        ("Tree planting drive", "Planting native saplings with local residents."),
        ("Lake clean-up", "Clearing plastic and debris from the lake edge."),
        ("School garden build", "Setting up a kitchen garden with students."),
        ("Seed ball making", "Making seed balls for the monsoon with children."),
        ("Roadside planting", "Planting and staking saplings along a service road."),
    ],
}

VENUES = {
    "Bengaluru Urban": ["Community Hall, Jayanagar", "Govt School, Basavanagudi", "Agara Lake", "Ward Office, BTM Layout"],
    "Mysuru": ["Kukkarahalli Lake", "Govt High School, Mysuru", "Town Hall, Mysuru"],
    "Mandya": ["Govt Primary School, Malavalli", "PHC Mandya", "Anganwadi Centre, Maddur"],
    "Kolar": ["Town Hall, Kolar", "Zilla Parishad School, Kolar", "Kolar Lake bund"],
    "Hassan": ["DIET Campus, Hassan", "Market Square, Hassan", "Govt School, Arsikere"],
    "Tumakuru": ["Zilla Parishad School, Tumakuru", "District Library, Tumakuru", "NH-48 service road"],
}

SKILLS = ["Teaching", "First aid", "Kannada", "English", "Hindi", "Photography", "Driving",
          "Event logistics", "Counselling", "Nursing assistant", "Gardening", "Data entry",
          "Public speaking", "Social media", "Carpentry", "Cooking"]

STORIES = [
    "I joined to give a few hours a month. Now the Saturday sessions are the part of my week I look forward to most.",
    "Watching a child read a full page aloud for the first time is something I will not forget.",
    "The eye camp showed me how much a pair of glasses can change a child's year at school.",
    "I came for the tree planting and stayed for the people. We have planted hundreds of saplings together.",
    "Volunteering here taught me more about my own city than twenty years of living in it.",
    "The team trusts you with real responsibility from the first month. That made me want to do more.",
    "I am a retired teacher. Being back in a classroom, even on weekends, gave me my purpose back.",
    "At the blood donation drive I saw strangers line up at 7 in the morning to help people they will never meet.",
    "I learnt first aid here, and a month later I used it at home. I am grateful for that training.",
    "Our lake clean-up crew started with six people. Last month we were forty.",
    "The children in Malavalli now greet me by name. That is the best thank-you there is.",
    "Everything is organised properly: you know where to be, what to bring and who to ask.",
    "I brought my college friends to one event and now half of them volunteer every month.",
    "Helping at the nutrition talk made me change how I cook for my own family.",
]

NEWS = [
    ("Monsoon planting season closes with record sapling count", "Green Cover",
     "Volunteers planted across Mysuru, Kolar and Tumakuru in this year's monsoon season."),
    ("Eye camps reach schoolchildren in three districts", "Healthcare",
     "Screening camps in Mandya, Hassan and Kolar fitted children with their first pair of glasses."),
    ("Weekend reading circles expand to Hassan", "Education",
     "The reading programme that began in Jayanagar now runs every Saturday in Hassan too."),
    ("Blood donation drive with Kolar district blood bank", "Healthcare",
     "Donors turned out early on a Sunday morning for our joint drive."),
    ("New digital literacy classes for teenagers", "Education",
     "Students are learning safe phone use, typing and basic spreadsheets."),
    ("Lake clean-up crew grows to forty regulars", "Green Cover",
     "What started as a small weekend group now meets every month at Agara Lake."),
    ("Volunteer training day on first aid", "Healthcare",
     "Thirty volunteers completed hands-on first aid training with a partner hospital."),
    ("Annual volunteer meet in Bengaluru", "General",
     "Volunteers from all six districts met to share what worked this year."),
]


def ago(days):
    return date.today() - timedelta(days=days)


def ahead(days):
    return date.today() + timedelta(days=days)


def at9(d):
    return datetime.combine(d, datetime.min.time()).replace(hour=9)


def phone():
    return f"9{rng.randint(1000, 9999)} {rng.randint(10000, 99999)}"


def add_demo_data(db):
    if db.query(m.User).filter(m.User.email.like(f"%@{DOMAIN}")).first():
        print("Sample data is already there - nothing to do.")
        return

    cats = {c.name: c for c in db.query(m.Category).all()}
    dists = {d.name: d for d in db.query(m.District).all()}
    staff = db.query(m.User).filter(m.User.role.in_(["admin", "super_admin"])).all()
    if not cats or not dists or not staff:
        print("Run seed.py first: districts, categories and admins are needed.")
        return

    def an_admin():
        return rng.choice(staff)

    pw = hash_password("vol123")   # hashed once; bcrypt is slow on purpose

    # ------------------------------------------------------------------
    # Volunteers and their applications
    # ------------------------------------------------------------------
    print("Volunteers...")
    approved, used = [], set()
    plan = (["approved"] * 160 + ["pending"] * 20 + ["more_info"] * 7 +
            ["rejected"] * 8 + ["none"] * 5)
    rng.shuffle(plan)

    for i, state in enumerate(plan):
        while True:
            first, last = rng.choice(FIRST), rng.choice(LAST)
            if (first, last) not in used:
                used.add((first, last))
                break
        clean_last = last.lower().replace("'", "")
        email = f"{first.lower()}.{clean_last}{i}@{DOMAIN}"

        # Approved people joined over the last 30 months; the rest recently.
        joined = ago(rng.randint(40, 900)) if state == "approved" else ago(rng.randint(1, 30))

        user = m.User(name=f"{first} {last}", email=email, password_hash=pw,
                      role="volunteer", active=True, created_at=at9(joined))
        db.add(user)
        db.flush()

        if state == "none":
            continue

        dist = rng.choice(list(dists))
        submitted = joined + timedelta(days=rng.randint(0, 3))
        reviewed = submitted + timedelta(days=rng.randint(1, 5)) if state != "pending" else None
        if reviewed and reviewed > date.today():
            reviewed = date.today()

        db.add(m.Application(
            user_id=user.id, phone=phone(), city=dist.split()[0], district_id=dists[dist].id,
            category_id=rng.choice(list(cats.values())).id,
            availability=rng.choice(["Weekdays", "Weekends", "Both"]),
            hours_per_week=rng.choice([3, 4, 5, 6, 8, 10, 12]),
            skills=", ".join(rng.sample(SKILLS, 3)),
            experience=rng.choice([
                "Helped at school events and a local clean-up.",
                "Volunteered with a college NSS unit for two years.",
                "No formal experience yet, keen to learn.",
                "Tutored younger cousins and neighbours.",
                "Worked with a health NGO during the floods.",
            ]),
            motivation=rng.choice([
                "I want to give back to the district I grew up in.",
                "I have free weekends and want to use them well.",
                "Teaching is what I enjoy most.",
                "I care about green cover in our cities.",
                "I want practical experience in community health.",
            ]),
            emergency_name=f"{rng.choice(FIRST)} {last}", emergency_phone=phone(),
            status=state, submitted_at=submitted, reviewed_at=reviewed,
            reviewed_by_id=an_admin().id if reviewed else None,
            note={"more_info": "Please add a phone number we can reach on weekends, and your availability in June.",
                  "rejected": "We're not recruiting in your area right now. Please apply again next season."}.get(state, ""),
        ))

        if state == "approved":
            approved.append((user, reviewed or submitted))

    db.flush()

    # ------------------------------------------------------------------
    # Events
    # ------------------------------------------------------------------
    print("Events...")
    past, upcoming = [], []

    def make_event(when, status, capacity=None):
        cat = rng.choice(list(EVENT_TEMPLATES))
        title, desc = rng.choice(EVENT_TEMPLATES[cat])
        dist = rng.choice(list(dists))
        place = dist.split()[0]
        start = at9(when)
        ev = m.Event(
            title=f"{title}, {place}", category_id=cats[cat].id if cat in cats else None,
            district_id=dists[dist].id, venue=rng.choice(VENUES.get(dist, ["Community Hall"])),
            starts_at=start, ends_at=start + timedelta(hours=rng.choice([3, 4, 5, 7])),
            capacity=capacity or rng.choice([15, 20, 25, 30, 40, 50]), status=status,
            description=desc, created_at=start - timedelta(days=rng.randint(14, 40)),
        )
        db.add(ev)
        return ev

    for _ in range(42):
        past.append(make_event(ago(rng.randint(5, 540)), "completed"))
    for d in sorted(rng.sample(range(4, 95), 10)):
        upcoming.append(make_event(ahead(d), "published"))
    full_event = make_event(ahead(12), "published", capacity=12)
    upcoming.append(full_event)
    make_event(ahead(40), "draft")
    make_event(ahead(55), "draft")
    make_event(ahead(20), "cancelled")
    db.flush()

    # ------------------------------------------------------------------
    # Registrations and hours
    # ------------------------------------------------------------------
    print("Registrations and hours...")
    for ev in past:
        ev_day = ev.starts_at.date()
        eligible = [u for (u, since) in approved if since <= ev_day]
        if not eligible:
            continue
        n = min(len(eligible), rng.randint(max(3, ev.capacity // 3), max(4, int(ev.capacity * 0.9))))
        for u in rng.sample(eligible, n):
            db.add(m.Registration(event_id=ev.id, user_id=u.id, status="confirmed",
                                  registered_at=ev_day - timedelta(days=rng.randint(2, 14))))
            if rng.random() < 0.88:           # most people turn up
                recent = (date.today() - ev_day).days < 14
                roll = rng.random()
                status = "pending" if recent else ("rejected" if roll < 0.02 else "verified")
                if not recent and roll > 0.97:
                    status = "pending"        # a few older ones not yet checked
                hrs = rng.choice([2, 2.5, 3, 3.5, 4, 4, 5, 6, 7])
                db.add(m.VolunteerHours(
                    user_id=u.id, event_id=ev.id, hours=hrs, logged_at=ev_day, status=status,
                    note="Left early, hours don't match the sign-in sheet." if status == "rejected" else "",
                    verified_at=ev_day + timedelta(days=rng.randint(1, 6)) if status == "verified" else None,
                    verified_by_id=an_admin().id if status == "verified" else None,
                ))

    everyone = [u for (u, _) in approved]
    for ev in upcoming:
        if ev is full_event:
            takers = rng.sample(everyone, ev.capacity + 4)
            for k, u in enumerate(takers):
                db.add(m.Registration(event_id=ev.id, user_id=u.id,
                                      status="confirmed" if k < ev.capacity else "waitlisted",
                                      registered_at=ago(rng.randint(0, 6))))
        else:
            for u in rng.sample(everyone, rng.randint(2, max(3, ev.capacity // 2))):
                db.add(m.Registration(event_id=ev.id, user_id=u.id, status="confirmed",
                                      registered_at=ago(rng.randint(0, 10))))
    db.flush()

    # ------------------------------------------------------------------
    # Donations
    # ------------------------------------------------------------------
    print("Donations...")
    companies = ["Kaveri Textiles Pvt Ltd", "Nandi Infotech", "Malnad Agro Foods", "Sahyadri Motors",
                 "Brindavan Pharma", "Mysore Silk House", "Tumkur Steel Works"]
    for n in range(120):
        when = ago(rng.randint(0, 365))
        company = rng.random() < 0.12
        donor = rng.choice(companies) if company else (
            "Anonymous" if rng.random() < 0.1 else f"{rng.choice(FIRST)} {rng.choice(LAST)}")
        amount = rng.choice([50000, 75000, 100000, 150000]) if company else rng.choice(
            [500, 1000, 1000, 2000, 2500, 5000, 5000, 10000, 15000, 25000])
        verified = (date.today() - when).days > 10 or rng.random() < 0.5
        db.add(m.Donation(
            donor=donor, amount=amount, mode=rng.choice(["UPI", "UPI", "Bank transfer", "Cheque", "Cash"]),
            purpose=rng.choice(["Education", "Healthcare", "Green Cover", "General"]),
            date=when, status="verified" if verified else "pending",
            receipt_no=f"CS-DEMO-{when.year}-{n + 1:04d}" if verified else None,
        ))

    # ------------------------------------------------------------------
    # Testimonials, from real sample volunteers
    # ------------------------------------------------------------------
    print("Testimonials...")
    tellers = rng.sample(approved, len(STORIES))
    for k, ((u, since), body) in enumerate(zip(tellers, STORIES)):
        app = db.query(m.Application).filter(m.Application.user_id == u.id).first()
        dist = app.district.name if app and app.district else None
        status = "approved" if k < 10 else ("pending" if k < 13 else "rejected")
        db.add(m.Testimonial(
            user_id=u.id, name=u.name, role=f"Volunteer, {dist}" if dist else "Volunteer",
            body=body, submitted_at=ago(rng.randint(3, 200)), status=status,
            featured=status == "approved" and k < 3,
        ))

    # ------------------------------------------------------------------
    # News
    # ------------------------------------------------------------------
    print("News...")
    for k, (title, cat, excerpt) in enumerate(NEWS):
        published = k < 6
        when = ago(10 + k * 25)
        db.add(m.News(
            title=title, slug=f"demo-{k + 1}-" + "-".join(title.lower().split()[:5]),
            category=cat, author=rng.choice(["Comms Team", "Programme Office", "Field Team"]),
            excerpt=excerpt, body=excerpt + " Full story coming soon.",
            published_at=when if published else None,
            status="published" if published else "draft", pinned=(k == 0),
            created_at=at9(when - timedelta(days=2)),
        ))

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------
    print("Messages...")
    subjects = [
        ("Volunteering on weekdays", "Can I volunteer on weekday evenings only? I work during the day."),
        ("Donation receipt", "I donated by UPI last week. How do I get an 80G receipt?"),
        ("Health camp in our village", "Our panchayat would like a health camp. Who should we speak to?"),
        ("Corporate volunteering", "Our team of 25 wants to spend a Saturday volunteering. Is that possible?"),
        ("Certificate for college", "I need a volunteering certificate for my college by next month."),
        ("Thank you", "Thank you for the eye camp. My son can finally read the board."),
        ("Internship", "I'm a social work student looking for a 6-week internship."),
    ]
    for k in range(15):
        subj, body = rng.choice(subjects)
        status = rng.choice(["new", "new", "in_progress", "resolved", "resolved"])
        first, last = rng.choice(FIRST), rng.choice(LAST)
        db.add(m.Message(
            name=f"{first} {last}", email=f"{first.lower()}.{last.lower().replace(chr(39), '')}{k}@example.com",
            subject=subj, body=body, received_at=ago(rng.randint(0, 60)), status=status,
            assigned_to_id=an_admin().id if status != "new" else None,
            notes="Replied by email." if status == "resolved" else "",
        ))

    # ------------------------------------------------------------------
    # Partnerships
    # ------------------------------------------------------------------
    print("Partnerships...")
    partners = [
        ("Sunrise Public School", "school", "Hassan", 380), ("Vidya Vikas College", "college", "Mysuru", 900),
        ("Asha Kiran Children's Home", "community-center", "Kolar", 60), ("Green Earth Trust", "ngo", "Tumakuru", None),
        ("Nandi Infotech", "corporate", "Bengaluru", None), ("Govt Higher Primary School", "school", "Mandya", 210),
        ("St. Mary's Convent", "school", "Bengaluru", 650), ("Rural Health Collective", "ngo", "Mandya", None),
    ]
    for name, typ, place, kids in partners:
        status = rng.choice(["new", "new", "contacted", "active", "declined"])
        db.add(m.Partnership(
            institution_name=name, type=typ, contact_name=f"{rng.choice(FIRST)} {rng.choice(LAST)}",
            contact_role=rng.choice(["Principal", "Director", "Coordinator", "CSR Lead"]),
            email=f"contact@{name.lower().replace(' ', '').replace('.', '').replace(chr(39), '')}.example.org",
            phone=phone(), location=place, child_count=kids,
            message="We'd like to work with CareSphere on a regular programme for the people we serve.",
            received_at=ago(rng.randint(1, 90)), status=status,
            assigned_to_id=an_admin().id if status != "new" else None,
            notes="Intro call done." if status in ("contacted", "active") else "",
        ))

    # ------------------------------------------------------------------
    # Newsletter subscribers
    # ------------------------------------------------------------------
    print("Subscribers...")
    seen = set()
    for k in range(80):
        email = f"{rng.choice(FIRST).lower()}{rng.randint(1, 999)}@example.com"
        if email in seen or db.query(m.Subscriber).filter(m.Subscriber.email == email).first():
            continue
        seen.add(email)
        db.add(m.Subscriber(email=email, subscribed_at=at9(ago(rng.randint(0, 300))),
                            active=rng.random() > 0.06))

    db.flush()

    # ------------------------------------------------------------------
    # Certificate requests
    # ------------------------------------------------------------------
    print("Certificates...")
    cert_no = 100
    for (u, since) in rng.sample(approved, 18):
        typ = rng.choice(["hours", "participation", "completion"])
        worked = db.query(m.VolunteerHours).filter(
            m.VolunteerHours.user_id == u.id, m.VolunteerHours.status == "verified").first()
        if typ == "participation" and not worked:
            typ = "hours"
        status = rng.choice(["pending", "pending", "approved"])
        cert_no += 1
        when = ago(rng.randint(1, 60))
        db.add(m.Certificate(
            user_id=u.id, type=typ,
            purpose=rng.choice(["For my college's community service record.",
                                "Applying for a job that asks for volunteering proof.",
                                "For my scholarship application."]),
            event_id=worked.event_id if typ == "participation" else None,
            requested_at=when, status=status,
            reviewed_at=when + timedelta(days=2) if status == "approved" else None,
            reviewed_by_id=an_admin().id if status == "approved" else None, note="",
            certificate_no=f"CS-CERT-DEMO-{cert_no:04d}" if status == "approved" else None,
            issued_at=when + timedelta(days=2) if status == "approved" else None,
        ))

    # ------------------------------------------------------------------
    # Hall of Fame: the top volunteers by verified hours, each linked to
    # the event where they gave the most.
    # ------------------------------------------------------------------
    print("Hall of Fame...")
    totals = []
    for (u, since) in approved:
        rows = db.query(m.VolunteerHours).filter(
            m.VolunteerHours.user_id == u.id, m.VolunteerHours.status == "verified").all()
        if rows:
            best = max(rows, key=lambda h: float(h.hours))
            totals.append((sum(float(h.hours) for h in rows), len(rows), u, best))
    totals.sort(key=lambda t: t[0], reverse=True)

    for total, count, u, best in totals[:5]:
        ev = db.get(m.Event, best.event_id)
        db.add(m.Recognition(
            type="Recognition", user_id=u.id, event_id=best.event_id, title=u.name,
            body=f"{total:g} verified hours across {count} events, including {ev.title}",
            year=date.today().year,
        ))

    db.commit()

    # ------------------------------------------------------------------
    print("\nDone. Added:")
    print(f"  volunteers          {len(plan)}  ({len(approved)} approved)")
    print(f"  events              {len(past) + len(upcoming) + 3}  ({len(upcoming)} upcoming)")
    print(f"  registrations       {db.query(m.Registration).count()} in total now")
    print(f"  volunteer hours     {db.query(m.VolunteerHours).count()} entries in total now")
    print("  donations 120, testimonials 14, news 8, messages 15,")
    print("  partnerships 8, subscribers ~80, certificate requests 18, Hall of Fame 5")
    print(f"\nSample volunteers sign in with password vol123 (emails end @{DOMAIN}).")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        add_demo_data(db)
    finally:
        db.close()
