"""
CareSphere — public content
============================

News, gallery, testimonials, recognition and FAQ. Everything the public
site displays and the admin panel manages.

One rule runs through all of them: the public sees only finished content.
An anonymous request for /api/news returns published articles; an admin
request returns drafts as well. Same endpoint, different answer based on
who is asking, so the public site cannot accidentally leak a draft.

Deletes are super admin only throughout, matching the admin panel.
"""

import re
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..auth import require_admin, require_super_admin
from ..database import get_db
from ..models import District, Faq, GalleryItem, News, Recognition, Testimonial, User
from ..schemas import (
    FaqCreate,
    FaqOut,
    FaqUpdate,
    GalleryCreate,
    GalleryOut,
    GalleryUpdate,
    NewsCreate,
    NewsOut,
    NewsUpdate,
    RecognitionCreate,
    RecognitionOut,
    RecognitionUpdate,
    TestimonialCreate,
    TestimonialOut,
    TestimonialReview,
)
from .common import district_id_for, not_found, parse_id

news_router = APIRouter(prefix="/api/news", tags=["news"])
gallery_router = APIRouter(prefix="/api/gallery", tags=["gallery"])
testimonial_router = APIRouter(prefix="/api/testimonials", tags=["testimonials"])
recognition_router = APIRouter(prefix="/api/recognition", tags=["recognition"])
faq_router = APIRouter(prefix="/api/faq", tags=["faq"])

_optional_bearer = HTTPBearer(auto_error=False)


def viewer_is_staff(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
    db: Session = Depends(get_db),
) -> bool:
    """
    Works out whether the caller is staff, without requiring a login.

    Used by the public list endpoints so one route can serve both the
    public site and the admin panel. A missing or invalid token simply
    means "not staff" rather than an error.
    """
    if creds is None:
        return False
    try:
        from jose import jwt
        from ..config import ALGORITHM, SECRET_KEY

        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user = db.query(User).filter(User.id == int(payload.get("sub", 0))).first()
        return bool(user and user.active and user.role in ("admin", "super_admin"))
    except Exception:
        return False


def slugify(title: str) -> str:
    """'New tutoring centre opens' -> 'new-tutoring-centre-opens'"""
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:200] or "untitled"


def unique_slug(db: Session, title: str) -> str:
    base = slugify(title)
    slug = base
    n = 2
    while db.query(News).filter(News.slug == slug).first():
        slug = f"{base}-{n}"
        n += 1
    return slug


# ===========================================================================
#  NEWS
# ===========================================================================


def _shape_news(n: News) -> NewsOut:
    return NewsOut(
        id=n.id, title=n.title, slug=n.slug, category=n.category,
        author=n.author, link=n.link,
        excerpt=n.excerpt, body=n.body or "", imagePath=n.image_path,
        publishedAt=n.published_at, status=n.status, pinned=n.pinned,
        createdAt=n.created_at,
    )


@news_router.get("", response_model=List[NewsOut])
def list_news(
    db: Session = Depends(get_db),
    staff: bool = Depends(viewer_is_staff),
    category: Optional[str] = None,
    status_: Optional[str] = Query(None, alias="status"),
):
    q = db.query(News)

    if not staff:
        q = q.filter(News.status == "published")
    elif status_:
        q = q.filter(News.status == status_)

    if category:
        q = q.filter(News.category == category)

    rows = q.order_by(News.pinned.desc(), News.created_at.desc()).all()
    return [_shape_news(n) for n in rows]


@news_router.get("/{news_id}", response_model=NewsOut)
def get_news(
    news_id: str,
    db: Session = Depends(get_db),
    staff: bool = Depends(viewer_is_staff),
):
    row = db.query(News).filter(News.id == parse_id(news_id, "article")).first()
    if row is None or (row.status != "published" and not staff):
        raise not_found("article")
    return _shape_news(row)


@news_router.post("", response_model=NewsOut, status_code=201)
def create_news(
    body: NewsCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = News(
        title=body.title,
        slug=unique_slug(db, body.title),
        category=body.category,
        author=body.author,
        link=body.link,
        excerpt=body.excerpt,
        body=body.body or "",
        image_path=body.imagePath,
        status=body.status,
        pinned=body.pinned,
        published_at=date.today() if body.status == "published" else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _shape_news(row)


@news_router.patch("/{news_id}", response_model=NewsOut)
def update_news(
    news_id: str,
    body: NewsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = db.query(News).filter(News.id == parse_id(news_id, "article")).first()
    if row is None:
        raise not_found("article")

    changes = body.model_dump(exclude_unset=True)

    # Publishing for the first time stamps the date.
    if changes.get("status") == "published" and row.published_at is None:
        row.published_at = date.today()

    if "imagePath" in changes:
        row.image_path = changes.pop("imagePath")

    for field, value in changes.items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    return _shape_news(row)


@news_router.delete("/{news_id}", status_code=204)
def delete_news(
    news_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(News).filter(News.id == parse_id(news_id, "article")).first()
    if row is None:
        raise not_found("article")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


# ===========================================================================
#  GALLERY
# ===========================================================================


def _shape_gallery(g: GalleryItem) -> GalleryOut:
    return GalleryOut(
        id=g.id, caption=g.caption, album=g.album,
        district=g.district.name if g.district else None,
        imagePath=g.image_path, uploadedAt=g.uploaded_at,
    )


@gallery_router.get("", response_model=List[GalleryOut])
def list_gallery(
    db: Session = Depends(get_db),
    album: Optional[str] = None,
    district: Optional[str] = None,
):
    q = db.query(GalleryItem)
    if album:
        q = q.filter(GalleryItem.album == album)
    if district:
        q = q.join(District).filter(District.name == district)
    return [_shape_gallery(g) for g in q.order_by(GalleryItem.uploaded_at.desc()).all()]


@gallery_router.post("", response_model=GalleryOut, status_code=201)
def add_gallery_item(
    body: GalleryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = GalleryItem(
        caption=body.caption,
        album=body.album,
        district_id=district_id_for(db, body.district),
        image_path=body.imagePath,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _shape_gallery(row)


@gallery_router.patch("/{item_id}", response_model=GalleryOut)
def update_gallery_item(
    item_id: str,
    body: GalleryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = db.query(GalleryItem).filter(
        GalleryItem.id == parse_id(item_id, "image")
    ).first()
    if row is None:
        raise not_found("image")

    changes = body.model_dump(exclude_unset=True)
    if "district" in changes:
        row.district_id = district_id_for(db, changes.pop("district"))
    if "imagePath" in changes:
        row.image_path = changes.pop("imagePath")
    for field, value in changes.items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    return _shape_gallery(row)


@gallery_router.delete("/{item_id}", status_code=204)
def delete_gallery_item(
    item_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(GalleryItem).filter(
        GalleryItem.id == parse_id(item_id, "image")
    ).first()
    if row is None:
        raise not_found("image")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


# ===========================================================================
#  TESTIMONIALS
# ===========================================================================


@testimonial_router.get("", response_model=List[TestimonialOut])
def list_testimonials(
    db: Session = Depends(get_db),
    staff: bool = Depends(viewer_is_staff),
    featured: Optional[bool] = None,
):
    """
    The public sees approved testimonials only. Someone's unreviewed
    submission never appears on the site by accident.
    """
    q = db.query(Testimonial)
    if not staff:
        q = q.filter(Testimonial.status == "approved")
    if featured is not None:
        q = q.filter(Testimonial.featured == featured)

    return q.order_by(Testimonial.submitted_at.desc()).all()


@testimonial_router.post("", response_model=TestimonialOut, status_code=201)
def submit_testimonial(body: TestimonialCreate, db: Session = Depends(get_db)):
    """
    Open to the public — parents and beneficiaries have no accounts.
    Always saved as pending, so nothing reaches the site unreviewed.
    """
    row = Testimonial(
        name=body.name.strip(),
        role=body.role,
        body=body.body.strip(),
        submitted_at=date.today(),
        status="pending",
        featured=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@testimonial_router.patch("/{item_id}", response_model=TestimonialOut)
def review_testimonial(
    item_id: str,
    body: TestimonialReview,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = db.query(Testimonial).filter(
        Testimonial.id == parse_id(item_id, "testimonial")
    ).first()
    if row is None:
        raise not_found("testimonial")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    return row


@testimonial_router.delete("/{item_id}", status_code=204)
def delete_testimonial(
    item_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(Testimonial).filter(
        Testimonial.id == parse_id(item_id, "testimonial")
    ).first()
    if row is None:
        raise not_found("testimonial")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


# ===========================================================================
#  RECOGNITION
# ===========================================================================


@recognition_router.get("", response_model=List[RecognitionOut])
def list_recognition(db: Session = Depends(get_db), type: Optional[str] = None):
    q = db.query(Recognition)
    if type:
        q = q.filter(Recognition.type == type)
    return q.order_by(Recognition.year.desc()).all()


@recognition_router.post("", response_model=RecognitionOut, status_code=201)
def create_recognition(
    body: RecognitionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = Recognition(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@recognition_router.patch("/{item_id}", response_model=RecognitionOut)
def update_recognition(
    item_id: str,
    body: RecognitionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = db.query(Recognition).filter(
        Recognition.id == parse_id(item_id, "entry")
    ).first()
    if row is None:
        raise not_found("entry")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@recognition_router.delete("/{item_id}", status_code=204)
def delete_recognition(
    item_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(Recognition).filter(
        Recognition.id == parse_id(item_id, "entry")
    ).first()
    if row is None:
        raise not_found("entry")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


# ===========================================================================
#  FAQ
# ===========================================================================


def _shape_faq(f: Faq) -> FaqOut:
    return FaqOut(
        id=f.id, category=f.category, question=f.question,
        answer=f.answer, display_order=f.display_order,
    )


@faq_router.get("", response_model=List[FaqOut])
def list_faq(db: Session = Depends(get_db), category: Optional[str] = None):
    q = db.query(Faq)
    if category:
        q = q.filter(Faq.category == category)
    return [_shape_faq(f) for f in q.order_by(Faq.display_order).all()]


@faq_router.post("", response_model=FaqOut, status_code=201)
def create_faq(
    body: FaqCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = Faq(
        category=body.category, question=body.question,
        answer=body.answer, display_order=body.order,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _shape_faq(row)


@faq_router.patch("/{item_id}", response_model=FaqOut)
def update_faq(
    item_id: str,
    body: FaqUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    row = db.query(Faq).filter(Faq.id == parse_id(item_id, "question")).first()
    if row is None:
        raise not_found("question")

    changes = body.model_dump(exclude_unset=True)
    if "order" in changes:
        row.display_order = changes.pop("order")
    for field, value in changes.items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    return _shape_faq(row)


@faq_router.delete("/{item_id}", status_code=204)
def delete_faq(
    item_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    row = db.query(Faq).filter(Faq.id == parse_id(item_id, "question")).first()
    if row is None:
        raise not_found("question")
    db.delete(row)
    db.commit()
    return Response(status_code=204)
