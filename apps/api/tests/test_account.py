import pyotp
from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import login


def test_password_and_preferences(seeded):
    with TestClient(app) as client:
        csrf = login(client, "worker@example.com")
        bad = client.post(
            "/api/v1/auth/me/password",
            json={"current_password": "wrong-password", "new_password": "new-strong-password-1"},
            headers=csrf,
        )
        assert bad.status_code == 400

        ok = client.post(
            "/api/v1/auth/me/password",
            json={
                "current_password": "strong-password-123",
                "new_password": "new-strong-password-1",
            },
            headers=csrf,
        )
        assert ok.status_code == 200, ok.text

        fail_login = client.post(
            "/api/v1/auth/login",
            json={"email": "worker@example.com", "password": "strong-password-123"},
        )
        assert fail_login.status_code == 401

        login_new = client.post(
            "/api/v1/auth/login",
            json={"email": "worker@example.com", "password": "new-strong-password-1"},
        )
        assert login_new.status_code == 200, login_new.text
        csrf = {"X-CSRF-Token": login_new.json()["csrf_token"]}

        prefs = client.patch(
            "/api/v1/auth/me/preferences",
            json={"theme": "dark", "week_starts_on": "sunday", "time_format": "h12"},
            headers=csrf,
        )
        assert prefs.status_code == 200, prefs.text
        body = prefs.json()
        assert body["theme"] == "dark"
        assert body["week_starts_on"] == "sunday"
        assert body["time_format"] == "h12"

        me = client.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["user"]["preferences"]["theme"] == "dark"


def test_totp_login_challenge(seeded):
    with TestClient(app) as client:
        csrf = login(client, "worker@example.com")
        bad_pw = client.post(
            "/api/v1/auth/me/2fa/totp/setup",
            json={"password": "wrong-password"},
            headers=csrf,
        )
        assert bad_pw.status_code == 400

        setup = client.post(
            "/api/v1/auth/me/2fa/totp/setup",
            json={"password": "strong-password-123"},
            headers=csrf,
        )
        assert setup.status_code == 200, setup.text
        secret = setup.json()["secret"]
        code = pyotp.TOTP(secret).now()
        confirm = client.post(
            "/api/v1/auth/me/2fa/totp/confirm",
            json={"code": code},
            headers=csrf,
        )
        assert confirm.status_code == 200, confirm.text
        assert confirm.json()["totp_enabled"] is True

        client.post("/api/v1/auth/logout", headers=csrf)
        step1 = client.post(
            "/api/v1/auth/login",
            json={"email": "worker@example.com", "password": "strong-password-123"},
        )
        assert step1.status_code == 200, step1.text
        payload = step1.json()
        assert payload.get("requires_2fa") is True
        challenge = payload["challenge_token"]
        bad = client.post(
            "/api/v1/auth/login/2fa",
            json={"challenge_token": challenge, "code": "000000"},
        )
        assert bad.status_code == 401
        ok = client.post(
            "/api/v1/auth/login/2fa",
            json={"challenge_token": challenge, "code": pyotp.TOTP(secret).now()},
        )
        assert ok.status_code == 200, ok.text
        assert ok.json()["user"]["email"] == "worker@example.com"


def test_email_otp_setup_confirm(seeded):
    with TestClient(app) as client:
        csrf = login(client, "worker@example.com")
        setup = client.post(
            "/api/v1/auth/me/2fa/email/setup",
            json={"password": "strong-password-123"},
            headers=csrf,
        )
        assert setup.status_code == 200, setup.text
        body = setup.json()
        assert body["ok"] is True
        assert body.get("email_sent") is False
        code = body["dev_code"]

        bad = client.post(
            "/api/v1/auth/me/2fa/email/confirm",
            json={"code": "000000"},
            headers=csrf,
        )
        assert bad.status_code == 400

        confirm = client.post(
            "/api/v1/auth/me/2fa/email/confirm",
            json={"code": code},
            headers=csrf,
        )
        assert confirm.status_code == 200, confirm.text
        assert confirm.json()["email_otp_enabled"] is True

        client.post("/api/v1/auth/logout", headers=csrf)
        step1 = client.post(
            "/api/v1/auth/login",
            json={"email": "worker@example.com", "password": "strong-password-123"},
        )
        assert step1.status_code == 200
        assert step1.json().get("requires_2fa") is True


def test_profile_patch(seeded):
    with TestClient(app) as client:
        csrf = login(client, "worker@example.com")
        result = client.patch(
            "/api/v1/auth/me/profile",
            json={"first_name": "Anna", "last_name": "Nowak", "phone": "+48111222333"},
            headers=csrf,
        )
        assert result.status_code == 200, result.text
        user = result.json()["user"]
        assert user["first_name"] == "Anna"
        assert user["last_name"] == "Nowak"
        assert user["phone"] == "+48111222333"
