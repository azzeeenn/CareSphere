"""
CareSphere — database tables
=============================

Each class below becomes one table in PostgreSQL. Each Column becomes one
column. Alembic reads this file to work out what to create.

Derived directly from the collections in frontend/js/store.js.

Two conventions used throughout:

  * Statuses are stored as short text with a CHECK constraint listing the
    allowed values. Postgres will reject anything else, so a typo in the
    admin panel can never save a nonsense status.

  * Names that were copied into records in store.js (application.name,
    hours.eventTitle, and so on) are gone. They live in one place now and
    are reached through relationships. The API will still send them to the
    frontend, so no page needs to change.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


# ===========================================================================
#  LOOKUP TABLES
#  Districts and categories were hardcoded arrays in store.js. As tables,
#  an admin can add a seventh district without anyone editing code.
# ===========================================================================


class District(Base):
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True)
    name = Column(String(80), nullable=False, unique=True)


class Category(Base):
    """The three programme areas: Education, Healthcare, Green Cover."""

    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(60), nullable=False, unique=True)


# ===========================================================================
#  USERS
# ===========================================================================


class User(Base):
    """
    Admins, super admins and volunteers all live here, separated by role.

    Note password_hash, not password. Plaintext passwords never touch the
    database — passlib hashes them on the way in and compares hashes on
    the way out.
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    email = Column(String(180), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="volunteer")
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "role IN ('super_admin', 'admin', 'volunteer')",
            name="ck_users_role",
        ),
    )

    # Records belonging to this user
    application = relationship(
        "Application",
        back_populates="user",
        foreign_keys="Application.user_id",
        uselist=False,          # one application per volunteer
    )
    registrations = relationship("Registration", back_populates="user")
    hours = relationship(
        "VolunteerHours",
        back_populates="user",
        foreign_keys="VolunteerHours.user_id",
    )
    certificates = relationship(
        "Certificate",
        back_populates="user",
        foreign_keys="Certificate.user_id",
    )


# ===========================================================================
#  VOLUNTEER APPLICATIONS
# ===========================================================================


class Application(Base):
    """
    One per volunteer. 'not_submitted' is not stored — a volunteer with no
    application simply has no row here, and the dashboard shows that state
    itself.
    """

    __tablename__ = "applications"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    phone = Column(String(30))
    city = Column(String(120))
    district_id = Column(Integer, ForeignKey("districts.id"))
    category_id = Column(Integer, ForeignKey("categories.id"))   # "interest"

    availability = Column(String(20))          # Weekdays | Weekends | Both
    hours_per_week = Column(Integer)
    skills = Column(Text)
    experience = Column(Text)
    motivation = Column(Text)

    emergency_name = Column(String(120))
    emergency_phone = Column(String(30))

    status = Column(String(20), nullable=False, default="pending")
    submitted_at = Column(Date, nullable=False, default=datetime.utcnow)
    reviewed_at = Column(Date)
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    note = Column(Text, default="")

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'more_info')",
            name="ck_applications_status",
        ),
        CheckConstraint(
            "availability IN ('Weekdays', 'Weekends', 'Both')",
            name="ck_applications_availability",
        ),
    )

    user = relationship("User", back_populates="application", foreign_keys=[user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    district = relationship("District")
    category = relationship("Category")


# ===========================================================================
#  EVENTS AND REGISTRATIONS
# ===========================================================================


class Event(Base):
    """
    The 'registered' count from store.js is deliberately absent. It is
    counted from the registrations table instead, so it can never drift
    out of step with reality.
    """

    __tablename__ = "events"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"))
    district_id = Column(Integer, ForeignKey("districts.id"))
    venue = Column(String(250))

    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime)
    capacity = Column(Integer, nullable=False, default=0)

    status = Column(String(20), nullable=False, default="draft")
    description = Column(Text)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'published', 'cancelled', 'completed')",
            name="ck_events_status",
        ),
    )

    category = relationship("Category")
    district = relationship("District")
    registrations = relationship(
        "Registration",
        back_populates="event",
        cascade="all, delete-orphan",
    )


class Registration(Base):
    """A volunteer signing up for one event."""

    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True)
    event_id = Column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status = Column(String(20), nullable=False, default="confirmed")
    registered_at = Column(Date, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        # The database itself refuses a double registration.
        UniqueConstraint("event_id", "user_id", name="uq_registration_once"),
        CheckConstraint(
            "status IN ('confirmed', 'waitlisted', 'cancelled')",
            name="ck_registrations_status",
        ),
    )

    event = relationship("Event", back_populates="registrations")
    user = relationship("User", back_populates="registrations")


# ===========================================================================
#  VOLUNTEER HOURS
# ===========================================================================


class VolunteerHours(Base):
    """
    Renamed from the 'hours' collection because 'hours' is also a column
    name here, and hours.hours reads badly.

    Numeric(5, 2) because your data has 3.5 — whole integers would round
    it away, and floats are imprecise.
    """

    __tablename__ = "volunteer_hours"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    event_id = Column(Integer, ForeignKey("events.id", ondelete="SET NULL"))

    hours = Column(Numeric(5, 2), nullable=False)
    logged_at = Column(Date, nullable=False, default=datetime.utcnow)
    status = Column(String(20), nullable=False, default="pending")
    note = Column(Text, default="")

    verified_at = Column(Date)
    verified_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'verified', 'rejected')",
            name="ck_hours_status",
        ),
        CheckConstraint("hours > 0", name="ck_hours_positive"),
    )

    user = relationship("User", back_populates="hours", foreign_keys=[user_id])
    verified_by = relationship("User", foreign_keys=[verified_by_id])
    event = relationship("Event")


# ===========================================================================
#  CERTIFICATES
# ===========================================================================


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    type = Column(String(20), nullable=False)
    purpose = Column(Text)

    # Only used by participation certificates
    event_id = Column(Integer, ForeignKey("events.id", ondelete="SET NULL"))

    # Only used by letters of recommendation
    reference_name = Column(String(120))
    reference_role = Column(String(120))
    reference_phone = Column(String(30))

    requested_at = Column(Date, nullable=False, default=datetime.utcnow)
    status = Column(String(20), nullable=False, default="pending")
    reviewed_at = Column(Date)
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    note = Column(Text, default="")

    certificate_no = Column(String(40), unique=True)   # null until issued
    issued_at = Column(Date)

    __table_args__ = (
        CheckConstraint(
            "type IN ('hours', 'participation', 'recommendation', 'completion')",
            name="ck_certificates_type",
        ),
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="ck_certificates_status",
        ),
    )

    user = relationship("User", back_populates="certificates", foreign_keys=[user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    event = relationship("Event")
    proofs = relationship(
        "CertificateProof",
        back_populates="certificate",
        cascade="all, delete-orphan",
    )


class CertificateProof(Base):
    """
    The 'proof' array from store.js. Uploaded files get a row each, with
    the file stored on disk and only its path kept here.
    """

    __tablename__ = "certificate_proofs"

    id = Column(Integer, primary_key=True)
    certificate_id = Column(
        Integer,
        ForeignKey("certificates.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_path = Column(String(400), nullable=False)
    original_name = Column(String(250))
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    certificate = relationship("Certificate", back_populates="proofs")


# ===========================================================================
#  DONATIONS
# ===========================================================================


class Donation(Base):
    """
    Numeric(12, 2) for money, never Float. Floats lose precision on
    decimal fractions, which is unacceptable for currency.
    """

    __tablename__ = "donations"

    id = Column(Integer, primary_key=True)
    donor = Column(String(180), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    mode = Column(String(40))              # UPI | Bank transfer | Cheque | Cash
    purpose = Column(String(60))           # includes "General", so plain text
    date = Column(Date, nullable=False, default=datetime.utcnow)
    status = Column(String(20), nullable=False, default="pending")
    receipt_no = Column(String(40), unique=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'verified')",
            name="ck_donations_status",
        ),
        CheckConstraint("amount > 0", name="ck_donations_amount_positive"),
    )


# ===========================================================================
#  CONTACT MESSAGES
# ===========================================================================


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    email = Column(String(180), nullable=False)
    subject = Column(String(200))
    body = Column(Text, nullable=False)
    received_at = Column(Date, nullable=False, default=datetime.utcnow)
    status = Column(String(20), nullable=False, default="new")
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    notes = Column(Text, default="")

    __table_args__ = (
        CheckConstraint(
            "status IN ('new', 'in_progress', 'resolved')",
            name="ck_messages_status",
        ),
    )

    assigned_to = relationship("User")


# ===========================================================================
#  PARTNERSHIPS
# ===========================================================================


class Partnership(Base):
    __tablename__ = "partnerships"

    id = Column(Integer, primary_key=True)
    institution_name = Column(String(200), nullable=False)
    type = Column(String(30), nullable=False)

    contact_name = Column(String(120))
    contact_role = Column(String(120))
    email = Column(String(180))
    phone = Column(String(30))
    location = Column(String(200))
    child_count = Column(Integer)
    message = Column(Text)

    received_at = Column(Date, nullable=False, default=datetime.utcnow)
    status = Column(String(20), nullable=False, default="new")
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    notes = Column(Text, default="")

    __table_args__ = (
        CheckConstraint(
            "type IN ('school', 'college', 'community-center', 'ngo', 'corporate')",
            name="ck_partnerships_type",
        ),
        CheckConstraint(
            "status IN ('new', 'contacted', 'active', 'declined')",
            name="ck_partnerships_status",
        ),
    )

    assigned_to = relationship("User")


# ===========================================================================
#  TESTIMONIALS
# ===========================================================================


class Testimonial(Base):
    __tablename__ = "testimonials"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    role = Column(String(150))            # "Parent, Mandya"
    body = Column(Text, nullable=False)
    submitted_at = Column(Date, nullable=False, default=datetime.utcnow)
    status = Column(String(20), nullable=False, default="pending")
    featured = Column(Boolean, nullable=False, default=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="ck_testimonials_status",
        ),
    )


# ===========================================================================
#  NEWS
# ===========================================================================


class News(Base):
    """
    category is plain text rather than a foreign key because news uses
    "General" alongside the three programme areas.
    """

    __tablename__ = "news"

    id = Column(Integer, primary_key=True)
    title = Column(String(250), nullable=False)
    slug = Column(String(250), unique=True)     # for clean article URLs
    category = Column(String(60))
    author = Column(String(120))                # byline, e.g. "Comms Team"
    link = Column(String(500))                  # external source, for press coverage
    excerpt = Column(Text)
    body = Column(Text, default="")
    image_path = Column(String(400))
    published_at = Column(Date)
    status = Column(String(20), nullable=False, default="draft")
    pinned = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'published')",
            name="ck_news_status",
        ),
    )


# ===========================================================================
#  GALLERY
# ===========================================================================


class GalleryItem(Base):
    """
    image_path is new. store.js had no image field at all, so the gallery
    could not actually show pictures. Files go on disk, path goes here.
    """

    __tablename__ = "gallery"

    id = Column(Integer, primary_key=True)
    caption = Column(String(250))
    album = Column(String(60))
    district_id = Column(Integer, ForeignKey("districts.id"))
    image_path = Column(String(400), nullable=False)
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    district = relationship("District")


# ===========================================================================
#  RECOGNITION
# ===========================================================================


class Recognition(Base):
    __tablename__ = "recognition"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    body = Column(String(250))
    year = Column(Integer)
    type = Column(String(30), nullable=False, default="Award")

    __table_args__ = (
        CheckConstraint(
            "type IN ('Award', 'Partner', 'Recognition')",
            name="ck_recognition_type",
        ),
    )


# ===========================================================================
#  FAQ
# ===========================================================================


class Faq(Base):
    """
    'order' is a reserved word in SQL (ORDER BY), so the column is called
    display_order. Using 'order' would need quoting everywhere.
    """

    __tablename__ = "faq"

    id = Column(Integer, primary_key=True)
    category = Column(String(60))
    question = Column(String(300), nullable=False)
    answer = Column(Text, nullable=False)
    display_order = Column(Integer, nullable=False, default=0)


# ===========================================================================
#  IMPACT NUMBERS
# ===========================================================================


class ImpactStat(Base):
    __tablename__ = "impact_stats"

    id = Column(Integer, primary_key=True)
    label = Column(String(120), nullable=False)
    value = Column(Integer, nullable=False, default=0)
    display_order = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ===========================================================================
#  SETTINGS
# ===========================================================================


class Settings(Base):
    """
    Exactly one row, forced by the CHECK on id. A second row is impossible,
    so the API can always fetch settings without worrying about which one.
    """

    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, default=1)
    org = Column(String(200), nullable=False, default="CareSphere Foundation")
    email = Column(String(180))
    phone = Column(String(40))
    address = Column(String(300))
    facebook = Column(String(250), default="")
    instagram = Column(String(250), default="")
    twitter = Column(String(250), default="")
    linkedin = Column(String(250), default="")

    __table_args__ = (
        CheckConstraint("id = 1", name="ck_settings_single_row"),
    )
