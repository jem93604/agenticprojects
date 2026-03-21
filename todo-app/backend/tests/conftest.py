"""
Test setup: isolated SQLite file + Alembic migrations, then import the FastAPI app.

Run from repo:
  cd todo-app/backend && PYTHONPATH=. ./venv/bin/python -m pytest
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]

# Fresh DB file for the whole test session (schema from Alembic).
_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pytest.sqlite")
_tmp.close()
TEST_DB_PATH = _tmp.name

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

from alembic.config import Config
from alembic import command

# Run migrations via Alembic API so we don't rely on `python -m alembic`.
alembic_cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
alembic_cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
command.upgrade(alembic_cfg, "head")

# Import app only after DATABASE_URL is set and migrations applied.
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.models.database import engine  # noqa: E402

# Delete in FK-safe order (children first). Omit alembic_version.
_TRUNCATE_TABLES = [
    "notifications",
    "task_comment_mentions",
    "task_comments",
    "task_assignees",
    "tasks",
    "project_members",
    "projects",
    "refresh_tokens",
    "password_reset_tokens",
    "users",
    "todo_tags",
    "todos",
    "tags",
]


def _truncate_data_tables() -> None:
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=OFF"))
        for table in _TRUNCATE_TABLES:
            try:
                conn.execute(text(f"DELETE FROM {table}"))
            except Exception:
                # Table may not exist in older schemas; ignore
                pass
        conn.execute(text("PRAGMA foreign_keys=ON"))


@pytest.fixture(autouse=True)
def _clean_db_between_tests() -> None:
    _truncate_data_tables()
    yield
    _truncate_data_tables()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def unique_suffix() -> str:
    import uuid

    return uuid.uuid4().hex[:10]
