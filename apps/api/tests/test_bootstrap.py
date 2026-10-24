import os

import pytest
from fastapi.testclient import TestClient

from app.db import Base, engine
from app.main import app


@pytest.fixture
def empty_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


def test_bootstrap_creates_admin_with_team_card(empty_db, monkeypatch):
    monkeypatch.setenv("BOOTSTRAP_EMAIL", "bootstrap.admin@example.com")
    monkeypatch.setenv("BOOTSTRAP_PASSWORD", "strong-password-123")
    monkeypatch.setenv("BOOTSTRAP_ORGANIZATION", "Bootstrap Org")
    monkeypatch.setenv("BOOTSTRAP_FIRST_NAME", "Ada")
    monkeypatch.setenv("BOOTSTRAP_LAST_NAME", "Admin")

    from app.bootstrap import main

    main()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "bootstrap.admin@example.com", "password": "strong-password-123"},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["user"]["employee_id"]
        csrf = {"X-CSRF-Token": body["csrf_token"]}
        me = client.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["user"]["employee_id"] == body["user"]["employee_id"]
        team = client.get("/api/v1/employees", headers=csrf)
        assert team.status_code == 200
        rows = team.json()
        assert len(rows) == 1
        assert rows[0]["email"] == "bootstrap.admin@example.com"
        assert rows[0]["first_name"] == "Ada"
        assert rows[0]["last_name"] == "Admin"
        assert rows[0]["employee_number"] == "0001"
        assert rows[0]["status"] == "active"


def test_bootstrap_rejects_when_organization_exists(empty_db, monkeypatch):
    monkeypatch.setenv("BOOTSTRAP_EMAIL", "first@example.com")
    monkeypatch.setenv("BOOTSTRAP_PASSWORD", "strong-password-123")
    from app.bootstrap import main

    main()
    with pytest.raises(SystemExit, match="już istnieje"):
        main()


def test_bootstrap_requires_env(empty_db, monkeypatch):
    monkeypatch.delenv("BOOTSTRAP_EMAIL", raising=False)
    monkeypatch.delenv("BOOTSTRAP_PASSWORD", raising=False)
    from app.bootstrap import main

    with pytest.raises(SystemExit, match="BOOTSTRAP_EMAIL"):
        main()
