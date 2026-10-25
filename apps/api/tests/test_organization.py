from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import login


def test_organization_patch_and_mail(seeded):
    with TestClient(app) as client:
        csrf = login(client, "admin@example.com")

        forbidden = TestClient(app)
        worker_csrf = login(forbidden, "worker@example.com")
        deny = forbidden.get("/api/v1/organization", headers=worker_csrf)
        assert deny.status_code == 403

        org = client.get("/api/v1/organization", headers=csrf)
        assert org.status_code == 200, org.text
        body = org.json()
        assert body["name"] == "Test"
        assert body["timezone"] == "Europe/Warsaw"
        assert "public_origin" in body

        patched = client.patch(
            "/api/v1/organization",
            json={"name": "Nowa firma", "timezone": "Europe/Berlin"},
            headers=csrf,
        )
        assert patched.status_code == 200, patched.text
        assert patched.json()["name"] == "Nowa firma"
        assert patched.json()["timezone"] == "Europe/Berlin"

        mail = client.get("/api/v1/organization/mail", headers=csrf)
        assert mail.status_code == 200, mail.text
        assert mail.json()["configured"] is False
        assert "password" not in mail.json()

        saved = client.put(
            "/api/v1/organization/mail",
            json={
                "host": "smtp.example.com",
                "port": 587,
                "from_address": "noreply@example.com",
                "starttls": True,
                "username": "smtp-user",
                "password": "secret-pass",
            },
            headers=csrf,
        )
        assert saved.status_code == 200, saved.text
        view = saved.json()
        assert view["configured"] is True
        assert view["host"] == "smtp.example.com"
        assert view["password_set"] is True
        assert "password" not in view
        assert "secret-pass" not in saved.text

        keep = client.put(
            "/api/v1/organization/mail",
            json={
                "host": "smtp.example.com",
                "port": 465,
                "from_address": "noreply@example.com",
                "starttls": False,
                "username": "smtp-user",
                "password": None,
            },
            headers=csrf,
        )
        assert keep.status_code == 200, keep.text
        assert keep.json()["port"] == 465
        assert keep.json()["password_set"] is True

        with patch("app.organization.deliver_mail") as deliver:
            test = client.post(
                "/api/v1/organization/mail/test",
                json={"to": "admin@example.com"},
                headers=csrf,
            )
            assert test.status_code == 200, test.text
            deliver.assert_called_once()
            kwargs = deliver.call_args.kwargs
            assert kwargs["to"] == "admin@example.com"
            assert kwargs["host"] == "smtp.example.com"
            assert kwargs["password"] == "secret-pass"


def test_mail_seed_from_env(seeded, monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "env.smtp.test")
    monkeypatch.setenv("SMTP_PORT", "2525")
    monkeypatch.setenv("SMTP_FROM", "seed@example.com")
    monkeypatch.setenv("SMTP_STARTTLS", "true")
    monkeypatch.setenv("SMTP_USER", "env-user")
    monkeypatch.setenv("SMTP_PASSWORD", "env-pass")
    monkeypatch.setenv("APP_SECRET", "test-app-secret-for-smtp")
    monkeypatch.setenv("COOKIE_SECURE", "false")

    with TestClient(app) as client:
        csrf = login(client, "admin@example.com")
        mail = client.get("/api/v1/organization/mail", headers=csrf)
        assert mail.status_code == 200, mail.text
        body = mail.json()
        assert body["configured"] is True
        assert body["host"] == "env.smtp.test"
        assert body["port"] == 2525
        assert body["from_address"] == "seed@example.com"
        assert body["starttls"] is True
        assert body["username"] == "env-user"
        assert body["password_set"] is True
