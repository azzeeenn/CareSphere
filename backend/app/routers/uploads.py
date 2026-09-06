"""
CareSphere — file uploads
==========================

    POST   /api/uploads/image              admin — gallery and news images
    POST   /api/certificates/{id}/proofs   the owner — supporting documents
    GET    /api/certificates/{id}/proofs   owner or admin
    DELETE /api/uploads/{folder}/{name}    super admin

Files are written to backend/uploads/ and served from /uploads/... The
database stores only the path.

Three things guard these endpoints, because an upload endpoint is the
easiest way to compromise a web application:

  1. An allow-list of content types. Anything not on it is refused. A
     block-list would mean guessing every dangerous extension, which
     never holds.

  2. The first bytes of the file are checked against its claimed type. A
     browser will happily say a .php script is image/png; the file's own
     header will not.

  3. The stored filename is generated here, never taken from the upload.
     A name like "../../app/main.py" would otherwise write outside the
     uploads folder entirely.

Size is capped by reading in chunks and stopping at the limit, rather
than loading the whole file into memory and measuring it afterwards.
"""

import secrets
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin, require_super_admin
from ..config import (
    ALLOWED_IMAGE_TYPES,
    ALLOWED_PROOF_TYPES,
    MAX_UPLOAD_BYTES,
    UPLOAD_DIR,
)
from ..database import get_db
from ..models import Certificate, CertificateProof, User
from .common import not_found, parse_id

router = APIRouter(prefix="/api/uploads", tags=["uploads"])
proof_router = APIRouter(prefix="/api/certificates", tags=["certificates"])


# Folders we will write to. Anything else is rejected, so a folder name
# cannot be used to escape the uploads directory.
FOLDERS = {"gallery", "news", "proofs"}

# First bytes of each format. JPEG starts FF D8 FF, PNG has an 8-byte
# signature, and so on.
SIGNATURES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png":  [b"\x89PNG\r\n\x1a\n"],
    "image/gif":  [b"GIF87a", b"GIF89a"],
    "image/webp": [b"RIFF"],           # plus "WEBP" at offset 8, checked below
    "application/pdf": [b"%PDF-"],
}


def _looks_like(head: bytes, content_type: str) -> bool:
    """Does the file's own header agree with the type it claims to be?"""
    magics = SIGNATURES.get(content_type)
    if not magics:
        return False

    if content_type == "image/webp":
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"

    return any(head.startswith(m) for m in magics)


def _save(upload: UploadFile, folder: str, allowed: dict) -> str:
    """
    Write an upload to disk and return the path to store in the database.

    Returns something like "uploads/gallery/20260902-3f9a1c2b8d.jpg".
    """
    if folder not in FOLDERS:
        raise HTTPException(status_code=400, detail="Unknown upload folder")

    content_type = (upload.content_type or "").lower()
    if content_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Allowed file types: " + ", ".join(sorted(allowed)),
        )

    # Read the first chunk and check it really is what it claims.
    head = upload.file.read(32)
    if not _looks_like(head, content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That file does not look like a " + content_type.split("/")[-1].upper(),
        )

    # A name we generate: date for readability, random hex so two uploads
    # in the same second cannot collide or be guessed.
    extension = allowed[content_type]
    name = f"{datetime.now():%Y%m%d}-{secrets.token_hex(6)}{extension}"

    destination = UPLOAD_DIR / folder
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / name

    written = 0
    try:
        with open(target, "wb") as out:
            out.write(head)
            written += len(head)

            while True:
                chunk = upload.file.read(64 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,   # payload too large
                        detail=f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
                    )
                out.write(chunk)
    except HTTPException:
        # Remove the partial file rather than leaving a broken one behind.
        target.unlink(missing_ok=True)
        raise
    except Exception:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Could not save the file")
    finally:
        upload.file.close()

    if written == 0:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="That file is empty")

    return f"uploads/{folder}/{name}"


@router.post("/image", status_code=201)
def upload_image(
    file: UploadFile = File(...),
    folder: str = "gallery",
    _: User = Depends(require_admin),
):
    """
    Upload an image, then send the returned path as imagePath when
    creating the gallery item or news article. Two steps rather than one,
    so a failed upload never leaves a half-made record behind.
    """
    path = _save(file, folder, ALLOWED_IMAGE_TYPES)
    return {
        "path": path,
        "url": "/" + path,
        "originalName": file.filename,
    }


@router.delete("/{folder}/{name}", status_code=204)
def delete_upload(
    folder: str,
    name: str,
    _: User = Depends(require_super_admin),
):
    """
    Remove a file from disk.

    The name is checked rather than trusted: anything with a path
    separator or a parent reference is refused, so this cannot be used to
    delete files elsewhere on the machine.
    """
    if folder not in FOLDERS:
        raise HTTPException(status_code=400, detail="Unknown upload folder")
    if "/" in name or "\\" in name or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid file name")

    target = (UPLOAD_DIR / folder / name).resolve()

    # Belt and braces: confirm the resolved path is still inside the
    # uploads directory before touching it.
    if not str(target).startswith(str(UPLOAD_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Invalid file name")

    if not target.is_file():
        raise not_found("file")

    target.unlink()
    return Response(status_code=204)


# ===========================================================================
#  CERTIFICATE PROOFS
# ===========================================================================


@proof_router.post("/{cert_id}/proofs", status_code=201)
def upload_proof(
    cert_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Attach a supporting document to a certificate request.

    Only the person who made the request can add to it, and only while it
    is still pending — a decided request should not gain new evidence
    after the fact.
    """
    cert = db.query(Certificate).filter(
        Certificate.id == parse_id(cert_id, "certificate")
    ).first()
    if cert is None:
        raise not_found("certificate")

    if cert.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add files to your own request",
        )

    if cert.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This request has already been {cert.status}",
        )

    if len(cert.proofs) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can attach up to five files",
        )

    original = file.filename
    path = _save(file, "proofs", ALLOWED_PROOF_TYPES)

    proof = CertificateProof(
        certificate_id=cert.id,
        file_path=path,
        original_name=original,
    )
    db.add(proof)
    db.commit()
    db.refresh(proof)

    return {
        "_id": str(proof.id),
        "path": proof.file_path,
        "url": "/" + proof.file_path,
        "originalName": proof.original_name,
        "uploadedAt": proof.uploaded_at,
    }


@proof_router.get("/{cert_id}/proofs")
def list_proofs(
    cert_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """The owner, or any admin reviewing the request."""
    cert = db.query(Certificate).filter(
        Certificate.id == parse_id(cert_id, "certificate")
    ).first()
    if cert is None:
        raise not_found("certificate")

    if cert.user_id != user.id and user.role not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own files",
        )

    return [
        {
            "_id": str(p.id),
            "path": p.file_path,
            "url": "/" + p.file_path,
            "originalName": p.original_name,
            "uploadedAt": p.uploaded_at,
        }
        for p in cert.proofs
    ]


@proof_router.delete("/{cert_id}/proofs/{proof_id}", status_code=204)
def delete_proof(
    cert_id: str,
    proof_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove one of your own attachments while the request is pending."""
    proof = db.query(CertificateProof).filter(
        CertificateProof.id == parse_id(proof_id, "file"),
        CertificateProof.certificate_id == parse_id(cert_id, "certificate"),
    ).first()
    if proof is None:
        raise not_found("file")

    cert = proof.certificate
    is_staff = user.role in ("admin", "super_admin")

    if cert.user_id != user.id and not is_staff:
        raise HTTPException(status_code=403, detail="That isn't your file")
    if cert.status != "pending" and not is_staff:
        raise HTTPException(
            status_code=409,
            detail=f"This request has already been {cert.status}",
        )

    # Remove the row first; if the file is already gone from disk the
    # record should still go, rather than leaving an entry pointing at
    # nothing.
    stored = UPLOAD_DIR.parent / proof.file_path
    db.delete(proof)
    db.commit()

    try:
        stored.unlink(missing_ok=True)
    except OSError:
        pass

    return Response(status_code=204)
