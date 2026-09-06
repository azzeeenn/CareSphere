"""
CareSphere — Alembic environment
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context

# Make the "app" package importable.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DATABASE_URL, Base   # noqa: E402
from app import models                        # noqa: E402,F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(DATABASE_URL, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
    