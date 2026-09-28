"""
CareSphere — application entry point
=====================================

Start the server from the backend/ folder:

    uvicorn app.main:app --reload

Then open http://127.0.0.1:8000/docs for an interactive page listing
every endpoint, where you can try them out without writing any frontend
code. That page is generated automatically from the route definitions.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import ALLOWED_ORIGINS, UPLOAD_DIR
from .routers import (
    admin,
    applications,
    auth,
    certificates,
    content,
    events,
    lookups,
    newsletter,
    participation,
    promotion,
    stats,
    uploads,
)

app = FastAPI(
    title="CareSphere API",
    description="Backend for the CareSphere NGO management platform.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# Your pages are served by Live Server on port 5500; this API runs on 8000.
# Browsers treat those as different origins and block the requests unless
# the API explicitly allows them, which is what this does.

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
# More routers get added here as they are built — events, applications,
# certificates and the rest.

app.include_router(auth.router)
app.include_router(events.router)
app.include_router(participation.reg_router)
app.include_router(participation.hours_router)
app.include_router(applications.router)
app.include_router(certificates.router)
app.include_router(lookups.router)

# Public content
app.include_router(content.news_router)
app.include_router(content.testimonial_router)
app.include_router(content.recognition_router)
app.include_router(content.faq_router)

# Live impact figures, counted from the records (public)
app.include_router(stats.stats_router)

# Volunteers applying to become admins
app.include_router(promotion.router)

# Newsletter sign-ups from the public site
app.include_router(newsletter.router)

# Operations and administration
app.include_router(admin.donation_router)
app.include_router(admin.contact_router)
app.include_router(admin.partnership_router)
app.include_router(admin.impact_router)
app.include_router(admin.settings_router)
app.include_router(admin.user_router)

# Files
app.include_router(uploads.router)
app.include_router(uploads.proof_router)

# ---------------------------------------------------------------------------
# Uploaded files
# ---------------------------------------------------------------------------
# Serves anything in backend/uploads/ at /uploads/... so an <img src> can
# point straight at it. The directory is created on startup so a fresh
# checkout does not fail before the first upload.

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/api/health", tags=["health"])
def health():
    """Quick check that the server is up. Useful when debugging CORS."""
    return {"status": "ok", "service": "caresphere-api"}
