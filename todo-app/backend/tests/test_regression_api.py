"""Automated regression tests for auth, projects, tasks, comments, mentions, notifications."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

DEFAULT_PASSWORD = "password123"


def _register(client: TestClient, handle: str, password: str = DEFAULT_PASSWORD) -> dict:
    r = client.post(
        "/api/v1/auth/register",
        json={"handle": handle, "password": password},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _login(client: TestClient, handle: str, password: str = DEFAULT_PASSWORD) -> tuple[str, str]:
    r = client.post(
        "/api/v1/auth/login",
        json={"handle": handle, "password": password},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    tokens = data["tokens"]
    return tokens["access_token"], tokens["refresh_token"]


def _bearer(access: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access}"}


def test_register_duplicate_handle_returns_400(client: TestClient, unique_suffix: str):
    h = f"dup_{unique_suffix}"
    _register(client, h)
    r = client.post("/api/v1/auth/register", json={"handle": h, "password": DEFAULT_PASSWORD})
    assert r.status_code == 400


def test_login_invalid_credentials_401(client: TestClient, unique_suffix: str):
    h = f"nouser_{unique_suffix}"
    r = client.post(
        "/api/v1/auth/login",
        json={"handle": h, "password": DEFAULT_PASSWORD},
    )
    assert r.status_code == 401


def test_refresh_rotates_token_old_refresh_invalid(client: TestClient, unique_suffix: str):
    h = f"refresh_{unique_suffix}"
    _register(client, h)
    access, refresh = _login(client, h)

    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200, r.text
    data = r.json()
    new_access = data["access_token"]
    new_refresh = data["refresh_token"]
    # Access token may be identical if issued in the same second (same exp); refresh must rotate.
    assert new_refresh != refresh

    r_old = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r_old.status_code == 401

    r_new = client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh})
    assert r_new.status_code == 200, r_new.text


def test_me_requires_auth(client: TestClient):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_me_with_token(client: TestClient, unique_suffix: str):
    h = f"me_{unique_suffix}"
    _register(client, h)
    access, _ = _login(client, h)
    r = client.get("/api/v1/auth/me", headers=_bearer(access))
    assert r.status_code == 200, r.text
    assert r.json()["handle"] == h


def test_non_member_cannot_access_project_tasks(client: TestClient, unique_suffix: str):
    alice = f"alice_{unique_suffix}"
    bob = f"bob_{unique_suffix}"
    _register(client, alice)
    _register(client, bob)
    a_access, _ = _login(client, alice)
    _login(client, bob)

    pr = client.post(
        "/api/v1/projects/",
        json={"name": "Secret"},
        headers=_bearer(a_access),
    )
    assert pr.status_code == 200, pr.text
    project_id = pr.json()["id"]

    b_access, _ = _login(client, bob)
    tr = client.get(
        f"/api/v1/projects/{project_id}/tasks",
        headers=_bearer(b_access),
    )
    assert tr.status_code == 404


def test_invited_member_can_list_tasks(client: TestClient, unique_suffix: str):
    alice = f"owner_{unique_suffix}"
    bob = f"member_{unique_suffix}"
    _register(client, alice)
    _register(client, bob)
    a_access, _ = _login(client, alice)

    pr = client.post(
        "/api/v1/projects/",
        json={"name": "Team"},
        headers=_bearer(a_access),
    )
    assert pr.status_code == 200, pr.text
    project_id = pr.json()["id"]

    inv = client.post(
        f"/api/v1/projects/{project_id}/invites",
        json={"handle": bob, "role": "MEMBER"},
        headers=_bearer(a_access),
    )
    assert inv.status_code == 200, inv.text

    b_access, _ = _login(client, bob)
    lr = client.get(
        f"/api/v1/projects/{project_id}/tasks",
        headers=_bearer(b_access),
    )
    assert lr.status_code == 200, lr.text
    assert lr.json() == []


def test_kanban_batch_updates_status_and_positions(client: TestClient, unique_suffix: str):
    u = f"kanban_{unique_suffix}"
    _register(client, u)
    access, _ = _login(client, u)

    pr = client.post(
        "/api/v1/projects/",
        json={"name": "Board"},
        headers=_bearer(access),
    )
    assert pr.status_code == 200, pr.text
    pid = pr.json()["id"]

    t1 = client.post(
        f"/api/v1/projects/{pid}/tasks",
        json={"title": "One", "status": "TODO"},
        headers=_bearer(access),
    )
    t2 = client.post(
        f"/api/v1/projects/{pid}/tasks",
        json={"title": "Two", "status": "TODO"},
        headers=_bearer(access),
    )
    assert t1.status_code == 200 and t2.status_code == 200
    id1, id2 = t1.json()["id"], t2.json()["id"]

    br = client.patch(
        f"/api/v1/projects/{pid}/tasks/batch",
        json={
            "updates": [
                {"task_id": id1, "status": "DOING", "position": 0},
                {"task_id": id2, "status": "TODO", "position": 0},
            ]
        },
        headers=_bearer(access),
    )
    assert br.status_code == 200, br.text

    doing = client.get(
        f"/api/v1/projects/{pid}/tasks?status=DOING",
        headers=_bearer(access),
    )
    assert doing.status_code == 200
    assert len(doing.json()) == 1
    assert doing.json()[0]["id"] == id1


def test_comment_with_mention_creates_notification_for_mentioned_user(
    client: TestClient, unique_suffix: str
):
    alice = f"a_{unique_suffix}"
    bob = f"b_{unique_suffix}"
    _register(client, alice)
    _register(client, bob)
    a_access, _ = _login(client, alice)

    pr = client.post(
        "/api/v1/projects/",
        json={"name": "Mentions"},
        headers=_bearer(a_access),
    )
    pid = pr.json()["id"]

    client.post(
        f"/api/v1/projects/{pid}/invites",
        json={"handle": bob, "role": "MEMBER"},
        headers=_bearer(a_access),
    )

    tr = client.post(
        f"/api/v1/projects/{pid}/tasks",
        json={"title": "Discuss"},
        headers=_bearer(a_access),
    )
    tid = tr.json()["id"]

    cr = client.post(
        f"/api/v1/projects/{pid}/tasks/{tid}/comments",
        json={"content": f"Please review @{bob}"},
        headers=_bearer(a_access),
    )
    assert cr.status_code == 201, cr.text
    body = cr.json()
    assert any(m["handle"] == bob for m in body["mentioned_users"])

    b_access, _ = _login(client, bob)
    nr = client.get("/api/v1/notifications", headers=_bearer(b_access))
    assert nr.status_code == 200, nr.text
    items = nr.json()
    assert len(items) >= 1
    assert items[0]["type"] == "MENTION"
    assert items[0]["payload"].get("mentioned_handle") == bob

    nid = items[0]["id"]
    mr = client.patch(
        f"/api/v1/notifications/{nid}/mark-read",
        headers=_bearer(b_access),
    )
    assert mr.status_code == 200, mr.text
    assert mr.json()["read_at"] is not None
