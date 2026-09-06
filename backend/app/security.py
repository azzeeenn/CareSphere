"""
CareSphere — password hashing
==============================

Two functions, used wherever a password is set or checked.

Why bcrypt directly instead of passlib:
    passlib 1.7.4 (the current release) breaks against bcrypt 4.1 and
    newer — it reads an attribute the bcrypt library removed. The bcrypt
    package alone does everything needed here, with fewer moving parts.

Why hashing at all:
    A hash is one-way. If the database ever leaks, nobody can read the
    passwords out of it. bcrypt is also deliberately slow, which makes
    brute-forcing impractical.
"""

import bcrypt


# bcrypt cannot hash more than 72 bytes. Longer input is silently truncated
# by some libraries and rejected by others, so we cut it ourselves and
# behave the same way every time.
_MAX_BYTES = 72


def hash_password(plain: str) -> str:
    """Turn a plain password into a hash safe to store in the database."""
    raw = plain.encode("utf-8")[:_MAX_BYTES]
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Check a login attempt against the stored hash. Never raises."""
    try:
        raw = plain.encode("utf-8")[:_MAX_BYTES]
        return bcrypt.checkpw(raw, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed hash in the database — treat as a failed login.
        return False
