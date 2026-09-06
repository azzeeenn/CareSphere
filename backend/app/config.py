"""
CareSphere — settings
======================

Values that differ between your laptop and a real server live here, read
from environment variables with sensible defaults for development.
"""

import os

# ---------------------------------------------------------------------------
# JWT signing key
# ---------------------------------------------------------------------------
# This key signs every login token. Anyone who knows it can forge a token
# for any user, so on a real server it must be set as an environment
# variable and never committed to code.
#
# To generate a proper one:
#     python -c "import secrets; print(secrets.token_urlsafe(48))"

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "dev-only-key-change-before-deploying-caresphere",
)

ALGORITHM = "HS256"

# How long a login lasts before the user must sign in again.
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_MINUTES", "720"))   # 12 hours


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# Your frontend is served by Live Server on a different port to this API.
# Browsers block cross-port requests unless the API says the origin is
# allowed, which is what this list does.
#
# Add any other port Live Server picks if it moves.

ALLOWED_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
]


# ---------------------------------------------------------------------------
# File uploads
# ---------------------------------------------------------------------------
# Uploaded files live on disk, not in the database. Databases are bad at
# storing large binaries — backups balloon and every read pulls the whole
# file through the connection. The table keeps the path; the disk keeps
# the bytes.

import pathlib

UPLOAD_DIR = pathlib.Path(
    os.getenv("UPLOAD_DIR", str(pathlib.Path(__file__).resolve().parent.parent / "uploads"))
)

# 5 MB. Large enough for a phone photo, small enough that nobody can fill
# the disk with a single request.
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))

# Only these. An allow-list, never a block-list — a block-list is a
# guessing game about what is dangerous, and you always lose.
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png":  ".png",
    "image/webp": ".webp",
    "image/gif":  ".gif",
}

# Certificate proof can also be a PDF (a letter, a scanned form).
ALLOWED_PROOF_TYPES = dict(ALLOWED_IMAGE_TYPES)
ALLOWED_PROOF_TYPES["application/pdf"] = ".pdf"
