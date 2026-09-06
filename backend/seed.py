"""
CareSphere — seed data
=======================

Loads the demo data from store.js into PostgreSQL.

Run it from the backend/ folder:

    python seed.py

It wipes every table first, so it is safe to run again whenever you want
a clean demo. It is the Postgres equivalent of CSStore.reset().

Passwords are hashed on the way in. The plaintext values below are only
here so you can still log in during development:

    Admins     admin123
    Volunteers vol123
"""

from datetime import date, datetime

from app.database import SessionLocal, engine
from app.security import hash_password
from app import models as m


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def d(s):
    """'2026-08-05' -> date object. Empty string -> None."""
    return date.fromisoformat(s) if s else None


def dt(s):
    """'2026-08-16T09:00' -> datetime object."""
    return datetime.fromisoformat(s) if s else None


def wipe(db):
    """Empty every table, children first so foreign keys never complain."""
    order = [
        m.CertificateProof, m.Certificate, m.VolunteerHours, m.Registration,
        m.Application, m.Event, m.GalleryItem, m.Message, m.Partnership,
        m.Testimonial, m.News, m.Recognition, m.Faq, m.ImpactStat,
        m.Donation, m.Settings, m.User, m.Category, m.District,
    ]
    for table in order:
        db.query(table).delete()
    db.commit()


# ---------------------------------------------------------------------------
# The seed
# ---------------------------------------------------------------------------

def run():
    db = SessionLocal()
    try:
        print("Clearing existing rows...")
        wipe(db)

        # --- Districts and categories -----------------------------------
        print("Districts and categories...")
        districts = {}
        for name in ["Bengaluru Urban", "Mysuru", "Mandya",
                     "Kolar", "Hassan", "Tumakuru"]:
            row = m.District(name=name)
            db.add(row)
            districts[name] = row

        categories = {}
        for name in ["Education", "Healthcare", "Green Cover"]:
            row = m.Category(name=name)
            db.add(row)
            categories[name] = row

        db.flush()   # assigns ids without committing yet

        # --- Users ------------------------------------------------------
        print("Users...")
        admin_pw = hash_password("admin123")
        vol_pw = hash_password("vol123")

        users = {}
        admin_rows = [
            ("usr_001", "Azeen",  "azeen@caresphere.org",  "super_admin", "2026-01-12"),
            ("usr_002", "Saija",  "saija@caresphere.org",  "admin",       "2026-02-03"),
            ("usr_003", "Sumaya", "sumaya@caresphere.org", "admin",       "2026-02-20"),
        ]
        for key, name, email, role, created in admin_rows:
            row = m.User(name=name, email=email, password_hash=admin_pw,
                         role=role, active=True, created_at=dt(created + "T00:00"))
            db.add(row)
            users[key] = row

        volunteer_rows = [
            ("usr_101", "Priya Nayak",   "priya.n@example.com",   "2026-07-28"),
            ("usr_102", "Arjun Shetty",  "arjun.s@example.com",   "2026-08-01"),
            ("usr_103", "Fatima Khan",   "fatima.k@example.com",  "2026-08-02"),
            ("usr_104", "Rohit Gowda",   "rohit.g@example.com",   "2026-08-04"),
            ("usr_105", "Meera Iyer",    "meera.i@example.com",   "2026-08-05"),
            ("usr_106", "Sandeep Kumar", "sandeep.k@example.com", "2026-08-06"),
            ("usr_107", "Lakshmi Devi",  "lakshmi.d@example.com", "2026-06-14"),
            ("usr_108", "Imran Sheikh",  "imran.s@example.com",   "2026-05-30"),
        ]
        for key, name, email, created in volunteer_rows:
            row = m.User(name=name, email=email, password_hash=vol_pw,
                         role="volunteer", active=True,
                         created_at=dt(created + "T00:00"))
            db.add(row)
            users[key] = row

        db.flush()

        # --- Applications -----------------------------------------------
        print("Applications...")
        applications = [
            ("usr_101", "98450 11223", "Bengaluru", "Bengaluru Urban", "Education",   "Weekends", 6,
             "Teaching, Kannada, English", "Two years tutoring at a govt school in Jayanagar.",
             "I want to keep teaching but with a wider reach.", "Suresh Nayak", "98801 44556",
             "pending", "2026-08-05", None, None),
            ("usr_102", "99012 33445", "Mysuru", "Mysuru", "Green Cover", "Both", 10,
             "Horticulture, driving", "Volunteered on a lake clean-up drive last year.",
             "Mysuru needs more tree cover and I have weekends free.", "Vinod Shetty", "97411 22334",
             "pending", "2026-08-06", None, None),
            ("usr_103", "90080 55667", "Mandya", "Mandya", "Healthcare", "Weekdays", 8,
             "Nursing assistant, Urdu", "Worked at a primary health centre for 18 months.",
             "Rural health camps are where I can be most useful.", "Nadia Khan", "90192 88776",
             "pending", "2026-08-06", None, None),
            ("usr_104", "88670 99001", "Hassan", "Hassan", "Education", "Weekends", 4,
             "Maths, photography", "None formally, but I tutor my cousins.",
             "I would like to start somewhere small and learn.", "Manjula Gowda", "88451 33221",
             "pending", "2026-08-07", None, None),
            ("usr_105", "97399 22110", "Kolar", "Kolar", "Healthcare", "Both", 12,
             "Pharmacy, record keeping", "Ran a medicine donation drive during the floods.",
             "I have time now and want to spend it well.", "Anand Iyer", "97300 11009",
             "pending", "2026-08-08", None, None),
            ("usr_106", "96320 44558", "Tumakuru", "Tumakuru", "Green Cover", "Weekends", 5,
             "Carpentry, logistics", "Helped set up stalls at a district fair.",
             "Planting drives sound like something I can do well.", "Geetha Kumar", "96110 77889",
             "pending", "2026-08-08", None, None),
            ("usr_107", "99860 12345", "Bengaluru", "Bengaluru Urban", "Education", "Weekdays", 15,
             "Curriculum design, Hindi", "Retired schoolteacher, 22 years in service.",
             "Teaching is what I know and I am not done yet.", "Raghav Devi", "99001 55443",
             "approved", "2026-06-15", "2026-06-17", "usr_001"),
            ("usr_108", "93420 88776", "Mysuru", "Mysuru", "Healthcare", "Both", 9,
             "First aid, Kannada, Urdu", "Certified first responder, two years with a local NGO.",
             "Camps in my district always run short of hands.", "Sabina Sheikh", "93111 44557",
             "approved", "2026-06-01", "2026-06-02", "usr_001"),
        ]
        for (uk, phone, city, dist, cat, avail, hpw, skills, exp, motiv,
             en, ep, status, sub, rev, revby) in applications:
            db.add(m.Application(
                user_id=users[uk].id, phone=phone, city=city,
                district_id=districts[dist].id, category_id=categories[cat].id,
                availability=avail, hours_per_week=hpw, skills=skills,
                experience=exp, motivation=motiv,
                emergency_name=en, emergency_phone=ep,
                status=status, submitted_at=d(sub), reviewed_at=d(rev),
                reviewed_by_id=users[revby].id if revby else None, note="",
            ))

        # --- Events -----------------------------------------------------
        print("Events...")
        events = {}
        event_rows = [
            ("evt_001", "Free eye screening camp", "Healthcare", "Mandya",
             "Govt Primary School, Malavalli", "2026-08-16T09:00", "2026-08-16T16:00", 20,
             "published", "Screening and free spectacles for schoolchildren, run with a partner hospital.",
             "2026-07-20"),
            ("evt_002", "Weekend reading circle", "Education", "Bengaluru Urban",
             "Community Hall, Jayanagar", "2026-08-22T10:00", "2026-08-22T13:00", 12,
             "published", "Storytelling and reading practice for children aged 6 to 11.",
             "2026-07-24"),
            ("evt_003", "Lake bund tree planting", "Green Cover", "Mysuru",
             "Kukkarahalli Lake", "2026-08-30T06:30", "2026-08-30T11:00", 40,
             "published", "Planting 300 saplings along the northern bund with the lake conservation group.",
             "2026-07-28"),
            ("evt_004", "Teacher training workshop", "Education", "Hassan",
             "DIET Campus, Hassan", "2026-09-05T09:30", "2026-09-05T17:00", 25,
             "published", "A day of classroom technique training for volunteer tutors.",
             "2026-08-01"),
            ("evt_005", "Blood donation drive", "Healthcare", "Kolar",
             "Town Hall, Kolar", "2026-09-14T08:00", "2026-09-14T15:00", 30,
             "draft", "Awaiting confirmation from the blood bank before publishing.",
             "2026-08-07"),
            ("evt_006", "School supplies distribution", "Education", "Tumakuru",
             "Zilla Parishad School", "2026-07-12T10:00", "2026-07-12T14:00", 15,
             "completed", "Notebooks and stationery handed out to 240 students.",
             "2026-06-18"),
        ]
        for key, title, cat, dist, venue, starts, ends, cap, status, desc, created in event_rows:
            row = m.Event(
                title=title, category_id=categories[cat].id,
                district_id=districts[dist].id, venue=venue,
                starts_at=dt(starts), ends_at=dt(ends), capacity=cap,
                status=status, description=desc, created_at=dt(created + "T00:00"),
            )
            db.add(row)
            events[key] = row

        db.flush()

        # --- Registrations ----------------------------------------------
        print("Registrations...")
        for ek, uk, status, when in [
            ("evt_001", "usr_107", "confirmed",  "2026-07-30"),
            ("evt_001", "usr_108", "confirmed",  "2026-07-31"),
            ("evt_002", "usr_107", "confirmed",  "2026-08-01"),
            ("evt_003", "usr_108", "waitlisted", "2026-08-03"),
        ]:
            db.add(m.Registration(event_id=events[ek].id, user_id=users[uk].id,
                                  status=status, registered_at=d(when)))

        # --- Volunteer hours --------------------------------------------
        print("Volunteer hours...")
        for uk, ek, hrs, when, status in [
            ("usr_107", "evt_006", 4.0, "2026-07-12", "pending"),
            ("usr_108", "evt_006", 3.5, "2026-07-12", "pending"),
            ("usr_107", "evt_002", 3.0, "2026-07-25", "pending"),
            ("usr_108", "evt_001", 6.0, "2026-06-21", "verified"),
        ]:
            db.add(m.VolunteerHours(
                user_id=users[uk].id, event_id=events[ek].id, hours=hrs,
                logged_at=d(when), status=status, note="",
                verified_at=d("2026-06-22") if status == "verified" else None,
                verified_by_id=users["usr_001"].id if status == "verified" else None,
            ))

        # --- Certificates -----------------------------------------------
        print("Certificates...")
        db.add(m.Certificate(
            user_id=users["usr_107"].id, type="hours",
            purpose="Applying for a teaching post and they've asked for proof of my volunteering.",
            reference_name="Ramesh Naik", reference_role="Headmaster, Hassan",
            reference_phone="94800 21134",
            requested_at=d("2026-08-06"), status="pending", note="",
        ))
        db.add(m.Certificate(
            user_id=users["usr_108"].id, type="participation",
            purpose="For my college's community service record.",
            event_id=events["evt_006"].id,
            requested_at=d("2026-08-07"), status="pending", note="",
        ))
        db.add(m.Certificate(
            user_id=users["usr_107"].id, type="participation",
            purpose="Keeping a record of the camps I've helped with.",
            event_id=events["evt_002"].id,
            requested_at=d("2026-07-02"), status="approved",
            reviewed_at=d("2026-07-04"), reviewed_by_id=users["usr_001"].id,
            note="", certificate_no="CS-CERT-2026-0007", issued_at=d("2026-07-04"),
        ))

        # --- Donations ---------------------------------------------------
        print("Donations...")
        for donor, amt, mode, purpose, when, status, receipt in [
            ("Ravi Prakash",        25000, "UPI",           "Education",   "2026-08-04", "verified", "CS-2026-0041"),
            ("Sunitha Menon",       10000, "Bank transfer", "Healthcare",  "2026-08-05", "verified", "CS-2026-0042"),
            ("Anonymous",            5000, "UPI",           "General",     "2026-08-06", "pending",  None),
            ("Kaveri Textiles Pvt", 75000, "Cheque",        "Green Cover", "2026-08-07", "pending",  None),
            ("Deepak Hegde",        25000, "UPI",           "Education",   "2026-08-08", "pending",  None),
        ]:
            db.add(m.Donation(donor=donor, amount=amt, mode=mode, purpose=purpose,
                              date=d(when), status=status, receipt_no=receipt))

        # --- Messages ----------------------------------------------------
        print("Messages...")
        for name, email, subject, body, when, status, assigned, notes in [
            ("Vidya Sharma", "vidya.s@example.com", "Partnership enquiry",
             "Our company would like to sponsor a health camp in Kolar. Who should we speak to?",
             "2026-08-08", "new", None, ""),
            ("Ganesh Bhat", "ganesh.b@example.com", "Question about volunteering",
             "Is there an age limit for volunteers? My father is 68 and keen to help.",
             "2026-08-08", "new", None, ""),
            ("Reena Joseph", "reena.j@example.com", "Donation receipt",
             "I donated last month but have not received a receipt yet.",
             "2026-08-07", "new", None, ""),
            ("Harish Patil", "harish.p@example.com", "Tree planting in Tumakuru",
             "Our residents association wants to host a planting drive. Can you help organise it?",
             "2026-08-07", "new", None, ""),
            ("Shalini Rao", "shalini.r@example.com", "Internship",
             "I am a final year student looking for a social work internship.",
             "2026-08-03", "in_progress", "usr_002", "Sent the internship brief, awaiting reply."),
            ("Mohan Reddy", "mohan.r@example.com", "Thank you",
             "The eye camp in Mandya was excellent. My mother finally has reading glasses.",
             "2026-07-29", "resolved", "usr_001", "Replied with thanks."),
        ]:
            db.add(m.Message(
                name=name, email=email, subject=subject, body=body,
                received_at=d(when), status=status,
                assigned_to_id=users[assigned].id if assigned else None, notes=notes,
            ))

        # --- Partnerships -------------------------------------------------
        print("Partnerships...")
        for inst, typ, cname, crole, email, phone, loc, kids, msg, when, status, assigned, notes in [
            ("Greenwood Public School", "school", "Priya Nair", "Principal",
             "priya.nair@greenwood.edu.in", "98450 33221", "Jayanagar, Bengaluru", 420,
             "We would like the reading circle programme for grades 4 to 6, ideally on Saturday mornings.",
             "2026-08-08", "new", None, ""),
            ("St. Xavier's College", "college", "Arjun Mehta", "Dean of Students",
             "arjun.mehta@stxaviers.ac.in", "99010 88774", "Mysuru", 1200,
             "Looking for credit-eligible volunteering slots for our final year social work students.",
             "2026-08-07", "contacted", "usr_002", "Call done 7 Aug. Sending the MOU draft this week."),
            ("Sunrise Community Center", "community-center", "Lakshmi Rao", "Director",
             "lakshmi@sunrisecc.org", "97399 44112", "Kolar", 85,
             "We need tutoring support and a health camp for the children under our care.",
             "2026-07-22", "active", "usr_001", "MOU signed 28 July. Sessions started 3 Aug."),
        ]:
            db.add(m.Partnership(
                institution_name=inst, type=typ, contact_name=cname, contact_role=crole,
                email=email, phone=phone, location=loc, child_count=kids, message=msg,
                received_at=d(when), status=status,
                assigned_to_id=users[assigned].id if assigned else None, notes=notes,
            ))

        # --- Testimonials --------------------------------------------------
        print("Testimonials...")
        for name, role, body, when, status, featured in [
            ("Nagaraj B", "Parent, Mandya",
             "My daughter could not read the blackboard for two years. After the camp she has glasses and her marks have gone up.",
             "2026-08-06", "pending", False),
            ("Anitha Kumari", "Volunteer, Bengaluru Urban",
             "I joined expecting to give a few hours a month. Two years later it is the part of my week I look forward to most.",
             "2026-08-07", "pending", False),
            ("Ramesh Naik", "Headmaster, Hassan",
             "The tutoring programme filled a gap we could not staff ourselves. Attendance is up across all three grades.",
             "2026-06-20", "approved", True),
            ("Savitha Rao", "Resident, Mysuru",
             "The lake looks different now. My grandchildren will see those trees grown.",
             "2026-05-11", "approved", False),
        ]:
            db.add(m.Testimonial(name=name, role=role, body=body,
                                 submitted_at=d(when), status=status, featured=featured))

        # --- News -----------------------------------------------------------
        print("News...")
        for title, slug, cat, excerpt, pub, status, pinned, created in [
            ("3,000 saplings planted across Mysuru district", "saplings-mysuru-2026", "Green Cover",
             "Our monsoon planting season closed with the highest sapling count we have recorded.",
             "2026-07-30", "published", True, "2026-07-29"),
            ("Eye camp reaches 240 schoolchildren in Mandya", "eye-camp-mandya-2026", "Healthcare",
             "A two-day screening drive fitted 61 children with their first pair of glasses.",
             "2026-07-18", "published", False, "2026-07-17"),
            ("New tutoring centre opens in Hassan", "tutoring-centre-hassan", "Education",
             "The centre will run six evenings a week from September.",
             None, "draft", False, "2026-08-05"),
            ("Annual report 2025-26 now available", "annual-report-2025-26", "General",
             "A full account of the year's programmes, finances and district coverage.",
             None, "draft", False, "2026-08-07"),
        ]:
            db.add(m.News(title=title, slug=slug, category=cat, excerpt=excerpt, body="",
                          published_at=d(pub), status=status, pinned=pinned,
                          created_at=dt(created + "T00:00")))

        # --- Gallery ---------------------------------------------------------
        # image_path points at files you will upload later. These are
        # placeholders so the table is not empty.
        print("Gallery...")
        for caption, album, dist, path, when in [
            ("Sapling planting at Kukkarahalli Lake", "Green Cover", "Mysuru",
             "uploads/gallery/placeholder-1.jpg", "2026-07-30"),
            ("Eye screening, Malavalli", "Healthcare", "Mandya",
             "uploads/gallery/placeholder-2.jpg", "2026-07-18"),
            ("Reading circle, Jayanagar", "Education", "Bengaluru Urban",
             "uploads/gallery/placeholder-3.jpg", "2026-07-11"),
            ("Supplies handover, Tumakuru", "Education", "Tumakuru",
             "uploads/gallery/placeholder-4.jpg", "2026-07-12"),
        ]:
            db.add(m.GalleryItem(caption=caption, album=album,
                                 district_id=districts[dist].id, image_path=path,
                                 uploaded_at=dt(when + "T00:00")))

        # --- Recognition -------------------------------------------------------
        print("Recognition...")
        for title, body, year, typ in [
            ("Karnataka State NGO Award", "Dept. of Social Welfare", 2025, "Award"),
            ("Green Initiative Certificate", "Karnataka Forest Dept.", 2024, "Award"),
            ("Partner — Vision Care Hospital", "Healthcare programme", 2023, "Partner"),
        ]:
            db.add(m.Recognition(title=title, body=body, year=year, type=typ))

        # --- FAQ ---------------------------------------------------------------
        print("FAQ...")
        for cat, q, a, order in [
            ("Volunteering", "Who can become a volunteer?",
             "Anyone above 18 living in or near our six operating districts.", 1),
            ("Volunteering", "How long does approval take?",
             "Applications are usually reviewed within three working days.", 2),
            ("Donations", "Are donations tax deductible?",
             "Yes, we are registered under 80G and issue receipts.", 3),
            ("Programmes", "Which districts do you work in?",
             "Bengaluru Urban, Mysuru, Mandya, Kolar, Hassan and Tumakuru.", 4),
        ]:
            db.add(m.Faq(category=cat, question=q, answer=a, display_order=order))

        # --- Impact numbers ------------------------------------------------------
        print("Impact numbers...")
        for i, (label, value) in enumerate([
            ("Beneficiaries reached", 24500),
            ("Trees planted", 12800),
            ("Health camps held", 96),
            ("Districts covered", 6),
            ("Active volunteers", 128),
        ], start=1):
            db.add(m.ImpactStat(label=label, value=value, display_order=i,
                                updated_at=dt("2026-07-12T00:00")))

        # --- Settings -------------------------------------------------------------
        print("Settings...")
        db.add(m.Settings(
            id=1, org="CareSphere Foundation", email="hello@caresphere.org",
            phone="+91 80 4123 6789",
            address="3rd Block, Jayanagar, Bengaluru 560011",
        ))

        db.commit()

        # --- Report ----------------------------------------------------------------
        print("\nDone. Row counts:")
        for table in [m.District, m.Category, m.User, m.Application, m.Event,
                      m.Registration, m.VolunteerHours, m.Certificate, m.Donation,
                      m.Message, m.Partnership, m.Testimonial, m.News,
                      m.GalleryItem, m.Recognition, m.Faq, m.ImpactStat, m.Settings]:
            print(f"  {table.__tablename__:<22} {db.query(table).count()}")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
