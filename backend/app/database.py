"""
CareSphere — database connection
=================================

This file does three things and nothing else:

  1. Builds the connection to PostgreSQL.
  2. Creates a session factory (a "session" is one conversation with the DB).
  3. Provides get_db(), which FastAPI uses to hand a session to each request
     and close it again afterwards.

Every other backend file imports from here. Nothing here needs changing
once it works.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


# ---------------------------------------------------------------------------
# Connection string
# ---------------------------------------------------------------------------
# Format:  postgresql://USER:PASSWORD@HOST:PORT/DATABASE
#
# Change the password below if you used something other than "dev" during
# the PostgreSQL install. Later, for deployment, set a DATABASE_URL
# environment variable instead and this default is ignored.

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:dev@localhost:5432/caresphere",
)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
# The engine manages a pool of connections to Postgres. One per application.
#
# echo=True prints every SQL statement SQLAlchemy runs to your terminal.
# Useful while building, noisy later — flip it to False when it stops
# being helpful.

engine = create_engine(
    DATABASE_URL,
    echo=True,
    pool_pre_ping=True,   # quietly reconnects if a connection went stale
)


# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
# SessionLocal() gives you a new session. Each API request gets its own.

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


# ---------------------------------------------------------------------------
# Base class for models
# ---------------------------------------------------------------------------
# Every table class in models.py inherits from this. It is how SQLAlchemy
# and Alembic discover what tables exist.

Base = declarative_base()


# ---------------------------------------------------------------------------
# Dependency used by FastAPI routes
# ---------------------------------------------------------------------------
# Written as a generator so the session is always closed, even if the
# request raises an error.
#
# Usage in a route:
#
#     @router.get("/events")
#     def list_events(db: Session = Depends(get_db)):
#         return db.query(Event).all()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
