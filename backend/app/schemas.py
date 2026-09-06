"""
CareSphere — request and response shapes
=========================================

Pydantic models. Two jobs:

  1. Validate what comes IN. If the frontend posts a login with no
     password, FastAPI rejects it with a clear 422 before your code runs.

  2. Control what goes OUT. UserOut has no password_hash field, so a
     hash can never leak into an API response even by accident.

Note the `_id` aliases. Your frontend and store.js expect documents with
an `_id` string, because that is what the Mongo-shaped API returned.
These schemas emit `_id` from the integer primary key, so no page needs
to change when the backend takes over.
"""

from datetime import date, datetime

# A field named `date` (donations) would shadow the `date` type in its own
# annotation, so the type is also available under a name nothing uses.
DateValue = date
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    """What the login form posts."""
    email: EmailStr
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    """
    A user as the API returns it. No password_hash — deliberately.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    name: str
    email: str
    role: str
    active: bool
    created_at: datetime = Field(serialization_alias="createdAt")

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        # store.js treats _id as a string, so keep that contract.
        return str(v)


class LoginResponse(BaseModel):
    """
    Returned on a successful login.

    token   — send this back on every later request as:
                  Authorization: Bearer <token>
    user    — so the frontend can show the name and branch on role
              without a second request.
    """
    token: str
    tokenType: str = "bearer"
    user: UserOut


class RegisterRequest(BaseModel):
    """Public volunteer sign-up. Role is always 'volunteer' — never trusted
    from the client, or anyone could create themselves an admin account."""
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class PasswordChangeRequest(BaseModel):
    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=6, max_length=128)


# ---------------------------------------------------------------------------
# Shared bits used by later routers
# ---------------------------------------------------------------------------

class LookupOut(BaseModel):
    """Districts and categories."""
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    name: str

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class Message(BaseModel):
    """Simple {"detail": "..."} style response for actions with no body."""
    detail: str


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------
# The field names below are the ones store.js already uses — startsAt,
# endsAt, createdAt — so the frontend keeps working unchanged. The Python
# attributes stay snake_case; the aliases handle the translation.

class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    title: str
    category: Optional[str] = None
    district: Optional[str] = None
    venue: Optional[str] = None
    startsAt: Optional[datetime] = None
    endsAt: Optional[datetime] = None
    capacity: int
    registered: int = 0
    status: str
    description: Optional[str] = None
    createdAt: Optional[datetime] = None

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class EventCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    category: Optional[str] = None
    district: Optional[str] = None
    venue: Optional[str] = Field(default=None, max_length=250)
    startsAt: datetime
    endsAt: Optional[datetime] = None
    capacity: int = Field(default=0, ge=0)
    status: str = "draft"
    description: Optional[str] = None


class EventUpdate(BaseModel):
    """Every field optional — send only what changed."""
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    category: Optional[str] = None
    district: Optional[str] = None
    venue: Optional[str] = None
    startsAt: Optional[datetime] = None
    endsAt: Optional[datetime] = None
    capacity: Optional[int] = Field(default=None, ge=0)
    status: Optional[str] = None
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# Registrations
# ---------------------------------------------------------------------------

class RegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    eventId: str
    eventTitle: Optional[str] = None
    userId: str
    name: Optional[str] = None
    status: str
    registeredAt: Optional[date] = None

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class RegistrationCreate(BaseModel):
    eventId: str


class RegistrationUpdate(BaseModel):
    """Cancelling keeps the row and marks it, rather than deleting it, so
    the event still has a record that the person had signed up."""
    status: str = Field(pattern="^(confirmed|waitlisted|cancelled)$")


# ---------------------------------------------------------------------------
# Volunteer hours
# ---------------------------------------------------------------------------

class HoursOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    userId: str
    name: Optional[str] = None
    eventId: Optional[str] = None
    eventTitle: Optional[str] = None
    hours: float
    loggedAt: Optional[date] = None
    status: str
    note: Optional[str] = ""

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class HoursCreate(BaseModel):
    eventId: Optional[str] = None
    hours: float = Field(gt=0, le=24)
    loggedAt: Optional[date] = None
    note: Optional[str] = ""


class HoursReview(BaseModel):
    """Admin verifying or rejecting a logged shift."""
    status: str = Field(pattern="^(verified|rejected)$")
    note: Optional[str] = ""


# ---------------------------------------------------------------------------
# Volunteer applications
# ---------------------------------------------------------------------------

class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    userId: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    interest: Optional[str] = None
    availability: Optional[str] = None
    hoursPerWeek: Optional[int] = None
    skills: Optional[str] = None
    experience: Optional[str] = None
    motivation: Optional[str] = None
    emergencyName: Optional[str] = None
    emergencyPhone: Optional[str] = None
    status: str
    submittedAt: Optional[date] = None
    reviewedAt: Optional[date] = None
    reviewedBy: Optional[str] = None
    note: Optional[str] = ""

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class ApplicationCreate(BaseModel):
    phone: str = Field(min_length=6, max_length=30)
    city: str = Field(min_length=2, max_length=120)
    district: str
    interest: str
    availability: str = Field(pattern="^(Weekdays|Weekends|Both)$")
    hoursPerWeek: int = Field(ge=1, le=60)
    skills: Optional[str] = ""
    experience: Optional[str] = ""
    motivation: str = Field(min_length=10)
    emergencyName: str = Field(min_length=2, max_length=120)
    emergencyPhone: str = Field(min_length=6, max_length=30)


class ApplicationReview(BaseModel):
    status: str = Field(pattern="^(approved|rejected|more_info)$")
    note: Optional[str] = ""


# ---------------------------------------------------------------------------
# Certificates
# ---------------------------------------------------------------------------

class CertificateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    userId: str
    name: Optional[str] = None
    email: Optional[str] = None
    type: str
    purpose: Optional[str] = None
    eventId: Optional[str] = ""
    eventTitle: Optional[str] = ""
    referenceName: Optional[str] = ""
    referenceRole: Optional[str] = ""
    referencePhone: Optional[str] = ""
    requestedAt: Optional[date] = None
    status: str
    reviewedAt: Optional[date] = None
    reviewedBy: Optional[str] = None
    note: Optional[str] = ""
    certificateNo: Optional[str] = ""
    issuedAt: Optional[date] = None
    totalHours: Optional[float] = None

    # URLs of any files attached to the request. Named `proof` because
    # that is what the volunteer pages already read.
    proof: List[str] = []

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class CertificateCreate(BaseModel):
    type: str = Field(pattern="^(hours|participation|recommendation|completion)$")
    purpose: str = Field(min_length=5)
    eventId: Optional[str] = None
    referenceName: Optional[str] = ""
    referenceRole: Optional[str] = ""
    referencePhone: Optional[str] = ""


class CertificateReview(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    note: Optional[str] = ""


# ---------------------------------------------------------------------------
# News
# ---------------------------------------------------------------------------

class NewsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    title: str
    slug: Optional[str] = None
    category: Optional[str] = None
    author: Optional[str] = None
    link: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = ""
    imagePath: Optional[str] = None
    publishedAt: Optional[date] = None
    status: str
    pinned: bool
    createdAt: Optional[datetime] = None

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class NewsCreate(BaseModel):
    title: str = Field(min_length=3, max_length=250)
    category: Optional[str] = None
    author: Optional[str] = Field(default=None, max_length=120)
    link: Optional[str] = Field(default=None, max_length=500)
    excerpt: Optional[str] = None
    body: Optional[str] = ""
    imagePath: Optional[str] = None
    status: str = Field(default="draft", pattern="^(draft|published)$")
    pinned: bool = False


class NewsUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=250)
    category: Optional[str] = None
    author: Optional[str] = None
    link: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    imagePath: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(draft|published)$")
    pinned: Optional[bool] = None


# ---------------------------------------------------------------------------
# Gallery
# ---------------------------------------------------------------------------

class GalleryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    caption: Optional[str] = None
    album: Optional[str] = None
    district: Optional[str] = None
    imagePath: str
    uploadedAt: Optional[datetime] = None

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class GalleryCreate(BaseModel):
    caption: Optional[str] = Field(default=None, max_length=250)
    album: Optional[str] = None
    district: Optional[str] = None
    imagePath: str = Field(min_length=1, max_length=400)


class GalleryUpdate(BaseModel):
    caption: Optional[str] = None
    album: Optional[str] = None
    district: Optional[str] = None
    imagePath: Optional[str] = None


# ---------------------------------------------------------------------------
# Testimonials
# ---------------------------------------------------------------------------

class TestimonialOut(BaseModel):
    # populate_by_name lets the field be filled from the column name
    # submitted_at while still going out to the browser as submittedAt,
    # matching NewsOut.publishedAt and GalleryOut.uploadedAt.
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int = Field(serialization_alias="_id")
    name: str
    role: Optional[str] = None
    body: str
    submittedAt: Optional[date] = Field(default=None, validation_alias="submitted_at")
    status: str
    featured: bool

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class TestimonialCreate(BaseModel):
    """Submitted from the public site — no login needed."""
    name: str = Field(min_length=2, max_length=120)
    role: Optional[str] = Field(default=None, max_length=150)
    body: str = Field(min_length=20, max_length=2000)


class TestimonialReview(BaseModel):
    """
    What an admin may change on a story.

    The wording fields are here because the review modal lets an organiser
    tidy spelling before publishing. Without them the edits were accepted
    and then silently dropped, because Pydantic ignores fields a model
    does not declare.
    """
    status: Optional[str] = Field(default=None, pattern="^(pending|approved|rejected)$")
    featured: Optional[bool] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    role: Optional[str] = Field(default=None, max_length=150)
    body: Optional[str] = Field(default=None, min_length=20, max_length=2000)


# ---------------------------------------------------------------------------
# Recognition
# ---------------------------------------------------------------------------

class RecognitionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    title: str
    body: Optional[str] = None
    year: Optional[int] = None
    type: str

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class RecognitionCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: Optional[str] = Field(default=None, max_length=250)
    year: Optional[int] = Field(default=None, ge=1900, le=2100)
    type: str = Field(default="Award", pattern="^(Award|Partner|Recognition)$")


class RecognitionUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    year: Optional[int] = Field(default=None, ge=1900, le=2100)
    type: Optional[str] = Field(default=None, pattern="^(Award|Partner|Recognition)$")


# ---------------------------------------------------------------------------
# FAQ
# ---------------------------------------------------------------------------

class FaqOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    category: Optional[str] = None
    question: str
    answer: str
    order: int = Field(validation_alias="display_order")

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class FaqCreate(BaseModel):
    category: Optional[str] = Field(default=None, max_length=60)
    question: str = Field(min_length=5, max_length=300)
    answer: str = Field(min_length=5)
    order: int = 0


class FaqUpdate(BaseModel):
    category: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    order: Optional[int] = None


# ---------------------------------------------------------------------------
# Donations
# ---------------------------------------------------------------------------

class DonationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    donor: str
    amount: float
    mode: Optional[str] = None
    purpose: Optional[str] = None
    date: Optional[DateValue] = None
    status: str
    receiptNo: Optional[str] = ""

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class DonationCreate(BaseModel):
    donor: str = Field(min_length=2, max_length=180)
    amount: float = Field(gt=0)
    mode: Optional[str] = Field(default=None, max_length=40)
    purpose: Optional[str] = Field(default=None, max_length=60)
    date: Optional[DateValue] = None


class DonationUpdate(BaseModel):
    donor: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
    mode: Optional[str] = None
    purpose: Optional[str] = None
    date: Optional[DateValue] = None
    status: Optional[str] = Field(default=None, pattern="^(pending|verified)$")


# ---------------------------------------------------------------------------
# Contact messages
# ---------------------------------------------------------------------------

class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    name: str
    email: str
    subject: Optional[str] = None
    body: str
    receivedAt: Optional[date] = None
    status: str
    assignedTo: Optional[str] = ""
    notes: Optional[str] = ""

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class ContactCreate(BaseModel):
    """From the public contact form — no login."""
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    subject: Optional[str] = Field(default=None, max_length=200)
    body: str = Field(min_length=10, max_length=5000)


class ContactUpdate(BaseModel):
    status: Optional[str] = Field(default=None, pattern="^(new|in_progress|resolved)$")
    assignedTo: Optional[str] = None      # admin's user id, as a string
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Partnerships
# ---------------------------------------------------------------------------

class PartnershipOut(BaseModel):
    # The columns are snake_case; the browser wants camelCase. The aliases
    # bridge the two when a row is read straight off the model, and
    # populate_by_name keeps it working where the router builds this by
    # keyword instead — assignedTo has to be built that way, because the
    # column is assigned_to_id and the page wants the person's name.
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int = Field(serialization_alias="_id")
    institutionName: str = Field(validation_alias="institution_name")
    type: str
    contactName: Optional[str] = Field(default=None, validation_alias="contact_name")
    contactRole: Optional[str] = Field(default=None, validation_alias="contact_role")
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    childCount: Optional[int] = Field(default=None, validation_alias="child_count")
    message: Optional[str] = None
    receivedAt: Optional[date] = Field(default=None, validation_alias="received_at")
    status: str
    assignedTo: Optional[str] = ""
    notes: Optional[str] = ""

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class PartnershipCreate(BaseModel):
    institutionName: str = Field(min_length=2, max_length=200)
    type: str = Field(pattern="^(school|college|community-center|ngo|corporate)$")
    contactName: Optional[str] = Field(default=None, max_length=120)
    contactRole: Optional[str] = Field(default=None, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    location: Optional[str] = Field(default=None, max_length=200)
    childCount: Optional[int] = Field(default=None, ge=0)
    message: Optional[str] = None


class PartnershipUpdate(BaseModel):
    status: Optional[str] = Field(default=None, pattern="^(new|contacted|active|declined)$")
    assignedTo: Optional[str] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Impact numbers
# ---------------------------------------------------------------------------

class ImpactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(serialization_alias="_id")
    label: str
    value: int
    order: int = Field(validation_alias="display_order")
    updatedAt: Optional[datetime] = None

    @field_serializer("id")
    def id_as_string(self, v: int) -> str:
        return str(v)


class ImpactCreate(BaseModel):
    label: str = Field(min_length=2, max_length=120)
    value: int = Field(ge=0)
    order: int = 0


class ImpactUpdate(BaseModel):
    label: Optional[str] = None
    value: Optional[int] = Field(default=None, ge=0)
    order: Optional[int] = None


# ---------------------------------------------------------------------------
# Organisation settings
# ---------------------------------------------------------------------------

class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    org: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    facebook: Optional[str] = ""
    instagram: Optional[str] = ""
    twitter: Optional[str] = ""
    linkedin: Optional[str] = ""


class SettingsUpdate(BaseModel):
    org: Optional[str] = Field(default=None, min_length=2, max_length=200)
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    facebook: Optional[str] = None
    instagram: Optional[str] = None
    twitter: Optional[str] = None
    linkedin: Optional[str] = None


# ---------------------------------------------------------------------------
# Admin user management
# ---------------------------------------------------------------------------

class AdminUserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(pattern="^(super_admin|admin|volunteer)$")


class AdminUserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    role: Optional[str] = Field(default=None, pattern="^(super_admin|admin|volunteer)$")
    active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)
