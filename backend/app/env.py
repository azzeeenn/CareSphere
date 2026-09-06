"""
CareSphere — Alembic environment
=================================

Edited from the file Alembic generates, in two ways:

  1. It imports your models, so `--autogenerate` can see every table.
  2. It builds the database connection directly from app/database.py and
     ignores alembic.ini's URL setting completely. That means the password
     lives in exactly one place and a stale alembic.ini cannot break
     anything.

You should not need to touch this file again.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context

# ---------------------------------------------------------------------------
# Make the "app" package importable.
# Alembic runs from the backend/ folder, so we add it to Python's path.
# ---------------------------------------------------------------------------
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DATABASE_URL, Base   # noqa: E402
from app import models                        # noqa: E402,F401  (registers tables)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# This is what lets `alembic revision --autogenerate` detect your tables.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Write the SQL to the screen instead of running it. Rarely used."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Connect to PostgreSQL and apply migrations. This is the normal path."""
    connectable = create_engine(DATABASE_URL, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,             # notice column type changes too
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
