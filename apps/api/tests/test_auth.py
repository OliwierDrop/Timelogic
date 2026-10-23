from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.main import app
from helpers import login

def test_auth_csrf_and_organization_scope(seeded):
    with TestClient(app) as worker:
        csrf = login(worker, "worker@example.com")
        assert worker.get("/api/v1/auth/me").json()["session_expires_at"]
        refreshed = worker.post("/api/v1/auth/refresh", json={}, headers=csrf)
        assert refreshed.status_code == 200
        csrf = {"X-CSRF-Token": refreshed.json()["csrf_token"]}
        assert worker.get(f"/api/v1/employees/{seeded['foreign']}").status_code == 404
        assert worker.get("/api/v1/employees").json()[0]["id"] == seeded["employee"]
        assert worker.post("/api/v1/time-entries", json={}, headers={"Idempotency-Key": "first"}).status_code == 403
        assert (
            worker.post(
                "/api/v1/time-entries",
                json={"employee_id": seeded["foreign"]},
                headers=csrf | {"Idempotency-Key": "foreign"},
            ).status_code
            == 404
        )
        assert worker.post("/api/v1/positions", json={"name": "Sekretariat"}, headers=csrf).status_code == 403


def test_invite_manager_scope_and_revoke(seeded):
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        invitation = admin.post(
            "/api/v1/auth/invite", json={"email": "manager@example.com", "role": "manager"}, headers=csrf
        )
        assert invitation.status_code == 201, invitation.text
        manager_id = invitation.json()["id"]
        token = parse_qs(urlparse(invitation.json()["invite_url"]).query)["token"][0]
        assert (
            admin.post(
                "/api/v1/auth/accept-invite", json={"token": token, "password": "manager-password-123"}
            ).status_code
            == 200
        )
        assert (
            admin.post(
                "/api/v1/auth/accept-invite", json={"token": token, "password": "manager-password-123"}
            ).status_code
            == 422
        )
        manager_card = admin.post(
            "/api/v1/employees",
            json={
                "first_name": "Anna",
                "last_name": "Kierownik",
                "user_id": manager_id,
                "role": "manager",
            },
            headers=csrf,
        )
        assert manager_card.status_code == 201, manager_card.text
        assert (
            admin.patch(
                f"/api/v1/employees/{seeded['employee']}",
                json={"supervisor_id": manager_card.json()["id"]},
                headers=csrf,
            ).status_code
            == 200
        )
        with TestClient(app) as manager:
            response = manager.post(
                "/api/v1/auth/login", json={"email": "manager@example.com", "password": "manager-password-123"}
            )
            assert response.status_code == 200
            visible = {row["id"] for row in manager.get("/api/v1/employees").json()}
            assert seeded["employee"] in visible
            assert manager_card.json()["id"] in visible
            assert manager.get(f"/api/v1/employees/{seeded['foreign']}").status_code == 404
            assert (
                admin.patch(f"/api/v1/auth/users/{manager_id}", json={"active": False}, headers=csrf).status_code == 200
            )
            assert manager.get("/api/v1/auth/me").status_code == 401
        self_id = admin.get("/api/v1/auth/me").json()["user"]["id"]
        assert admin.patch(f"/api/v1/auth/users/{self_id}", json={"active": False}, headers=csrf).status_code == 409


def test_employee_phone_and_email_change_confirm(seeded):
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        phone_only = admin.patch(
            f"/api/v1/employees/{seeded['employee']}",
            json={"phone": "+48500100200"},
            headers=csrf,
        )
        assert phone_only.status_code == 200, phone_only.text
        assert phone_only.json()["phone"] == "+48500100200"
        assert phone_only.json().get("email_change") is None

        changed = admin.patch(
            f"/api/v1/employees/{seeded['employee']}",
            json={"email": "worker.new@example.com"},
            headers=csrf,
        )
        assert changed.status_code == 200, changed.text
        body = changed.json()
        assert body["email"] == "worker@example.com"
        assert body["pending_email"] == "worker.new@example.com"
        assert body["email_change"]["pending_email"] == "worker.new@example.com"
        assert body["email_change"]["confirm_url"]
        token = parse_qs(urlparse(body["email_change"]["confirm_url"]).query)["token"][0]

        clash = admin.patch(
            f"/api/v1/employees/{seeded['employee']}",
            json={"email": "admin@example.com"},
            headers=csrf,
        )
        assert clash.status_code == 409

        with TestClient(app) as anon:
            bad = anon.post("/api/v1/auth/confirm-email", json={"token": "invalid"})
            assert bad.status_code == 422
            confirmed = anon.post("/api/v1/auth/confirm-email", json={"token": token})
            assert confirmed.status_code == 200, confirmed.text
            assert confirmed.json()["email"] == "worker.new@example.com"
            assert confirmed.json()["needs_password"] is False

        after = admin.get(f"/api/v1/employees/{seeded['employee']}")
        assert after.status_code == 200
        assert after.json()["email"] == "worker.new@example.com"
        assert after.json()["pending_email"] is None

        with TestClient(app) as worker:
            old = worker.post(
                "/api/v1/auth/login",
                json={"email": "worker@example.com", "password": "strong-password-123"},
            )
            assert old.status_code == 401
            login(worker, "worker.new@example.com")
            assert worker.get("/api/v1/auth/me").status_code == 200


