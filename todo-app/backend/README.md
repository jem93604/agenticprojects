# Todo / TaskFlow backend

## Automated regression tests

Uses **pytest** + **FastAPI TestClient** against a **temporary SQLite** database. Migrations are applied once per test session via Alembic.

```bash
cd todo-app/backend
python -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/pip install -r requirements-dev.txt

PYTHONPATH=. ./venv/bin/python -m pytest
```

Notes:

- Pin **`httpx<0.28`** (see `requirements-dev.txt`): Starlette’s `TestClient` is incompatible with httpx 0.28+.
- Pin **`bcrypt==3.2.2`** (see `requirements.txt`): `passlib` 1.7.4 breaks with bcrypt 4.x on newer Python.

## SQLite migrations (local)

```bash
cd todo-app/backend
PYTHONPATH=. ./venv/bin/alembic upgrade head
```
