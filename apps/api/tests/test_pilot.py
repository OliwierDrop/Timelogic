import os
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg://timelogic:change-this-local-password@localhost:55432/timelogic_test"
)
os.environ["COOKIE_SECURE"] = "false"
assert os.environ["DATABASE_URL"].endswith("/timelogic_test"), "Tests must use timelogic_test"

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Employee, Organization, Role, User, UserRole  # noqa: E402
from app.security import hashing  # noqa: E402


@pytest.fixture
def seeded():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal.begin() as db:
        org = Organization(name="Test")
        other = Organization(name="Inna")
        db.add_all([org, other])
        db.flush()
        role_ids = {}
        for code in ("admin", "employee", "manager", "hr"):
            role = Role(organization_id=org.id, code=code)
            db.add(role)
            db.flush()
            role_ids[code] = role.id
        admin = User(
            organization_id=org.id, email="admin@example.com", password_hash=hashing.hash("strong-password-123")
        )
        worker = User(
            organization_id=org.id, email="worker@example.com", password_hash=hashing.hash("strong-password-123")
        )
        db.add_all([admin, worker])
        db.flush()
        db.add_all(
            [
                UserRole(user_id=admin.id, role_id=role_ids["admin"]),
                UserRole(user_id=worker.id, role_id=role_ids["employee"]),
            ]
        )
        employee = Employee(
            organization_id=org.id,
            user_id=worker.id,
            employee_number="T001",
            first_name="Jan",
            last_name="Testowy",
        )
        foreign = Employee(organization_id=other.id, employee_number="X001", first_name="Inny", last_name="Pracownik")
        db.add_all([employee, foreign])
        db.flush()
        ids = {"employee": str(employee.id), "foreign": str(foreign.id)}
    yield ids
    Base.metadata.drop_all(engine)


def login(client: TestClient, email: str):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "strong-password-123"})
    assert response.status_code == 200, response.text
    return {"X-CSRF-Token": response.json()["csrf_token"]}


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


def test_start_break_stop_idempotency_and_correction(seeded):
    with TestClient(app) as worker:
        csrf = login(worker, "worker@example.com")
        start = worker.post("/api/v1/time-entries", json={}, headers=csrf | {"Idempotency-Key": "s1"})
        assert start.status_code == 201, start.text
        entry = start.json()
        assert worker.post("/api/v1/time-entries", json={}, headers=csrf | {"Idempotency-Key": "s1"}).json() == entry
        assert worker.post("/api/v1/time-entries", json={}, headers=csrf | {"Idempotency-Key": "s2"}).status_code == 409
        br = worker.post(
            f"/api/v1/time-entries/{entry['id']}/breaks", json={"paid": True}, headers=csrf | {"Idempotency-Key": "b1"}
        )
        assert br.status_code == 201, br.text
        break_id = br.json()["breaks"][0]["id"]
        assert (
            worker.post(
                f"/api/v1/time-entries/{entry['id']}/breaks",
                json={"paid": False},
                headers=csrf | {"Idempotency-Key": "b1"},
            ).status_code
            == 409
        )
        assert (
            worker.post(
                f"/api/v1/time-entries/{entry['id']}/stop", json={}, headers=csrf | {"Idempotency-Key": "e1"}
            ).status_code
            == 409
        )
        assert (
            worker.post(
                f"/api/v1/time-entries/{entry['id']}/breaks/{break_id}/stop",
                json={},
                headers=csrf | {"Idempotency-Key": "b2"},
            ).status_code
            == 200
        )
        stop = worker.post(
            f"/api/v1/time-entries/{entry['id']}/stop", json={}, headers=csrf | {"Idempotency-Key": "e2"}
        )
        assert stop.status_code == 200, stop.text
        assert (
            worker.post(
                f"/api/v1/time-entries/{entry['id']}/stop", json={}, headers=csrf | {"Idempotency-Key": "e2"}
            ).json()
            == stop.json()
        )
        started = datetime.fromisoformat(entry["started_at"])
        ended = datetime.fromisoformat(stop.json()["ended_at"])
        correction = worker.post(
            "/api/v1/attendance-corrections",
            json={
                "time_entry_id": entry["id"],
                "proposed_start": (started - timedelta(minutes=5)).isoformat(),
                "proposed_end": (ended + timedelta(minutes=5)).isoformat(),
                "reason": "Spóźniony zapis",
            },
            headers=csrf,
        )
        assert correction.status_code == 201, correction.text
        correction_id = correction.json()["id"]
        assert (
            worker.post(
                f"/api/v1/attendance-corrections/{correction_id}/decision", json={"approve": True}, headers=csrf
            ).status_code
            == 404
        )
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        approved = admin.post(
            f"/api/v1/attendance-corrections/{correction_id}/decision", json={"approve": True}, headers=csrf
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["status"] == "approved"
        assert (
            admin.post(
                f"/api/v1/attendance-corrections/{correction_id}/decision", json={"approve": True}, headers=csrf
            ).status_code
            == 409
        )
        assert any(row["action"] == "correction.decision" for row in admin.get("/api/v1/audit-logs").json())


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


def test_shifts_draft_publish_overlap_and_visibility(seeded):
    start = datetime(2026, 10, 26, 8, 0, tzinfo=timezone.utc)
    end = start + timedelta(hours=8)
    overlap_end = start + timedelta(hours=4)
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        draft = admin.post(
            "/api/v1/shifts",
            json={"employee_id": seeded["employee"], "started_at": start.isoformat(), "ended_at": end.isoformat()},
            headers=csrf,
        )
        assert draft.status_code == 201, draft.text
        shift_id = draft.json()["id"]
        assert draft.json()["published"] is False
        assert (
            admin.post(
                "/api/v1/shifts",
                json={
                    "employee_id": seeded["employee"],
                    "started_at": start.isoformat(),
                    "ended_at": overlap_end.isoformat(),
                },
                headers=csrf,
            ).status_code
            == 409
        )
        assert (
            admin.post(
                "/api/v1/shifts",
                json={"employee_id": seeded["foreign"], "started_at": start.isoformat(), "ended_at": end.isoformat()},
                headers=csrf,
            ).status_code
            == 404
        )
        with TestClient(app) as worker:
            login(worker, "worker@example.com")
            assert worker.get("/api/v1/shifts?include_drafts=true").json() == []
        published = admin.post("/api/v1/shifts/publish", json={"shift_ids": [shift_id]}, headers=csrf)
        assert published.status_code == 200, published.text
        assert published.json()[0]["published"] is True
        assert (
            admin.patch(
                f"/api/v1/shifts/{shift_id}",
                json={"ended_at": (end + timedelta(hours=1)).isoformat()},
                headers=csrf,
            ).status_code
            == 409
        )
        with TestClient(app) as worker:
            login(worker, "worker@example.com")
            visible = worker.get("/api/v1/shifts").json()
            assert len(visible) == 1
            assert visible[0]["id"] == shift_id
        assert any(row["action"] == "shift.publish" for row in admin.get("/api/v1/audit-logs").json())


def test_leave_request_balance_overlap_and_decision(seeded):
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        leave_type = admin.post(
            "/api/v1/leave-types", json={"code": "urlop", "name": "Urlop wypoczynkowy"}, headers=csrf
        )
        assert leave_type.status_code == 201, leave_type.text
        type_id = leave_type.json()["id"]
        assert (
            admin.post(
                "/api/v1/leave-types", json={"code": "urlop", "name": "Duplikat"}, headers=csrf
            ).status_code
            == 409
        )
        balance = admin.post(
            "/api/v1/leave-balances",
            json={
                "employee_id": seeded["employee"],
                "leave_type_id": type_id,
                "year": 2026,
                "granted_days": 5,
            },
            headers=csrf,
        )
        assert balance.status_code == 201, balance.text
        assert balance.json()["remaining_days"] == 5
        with TestClient(app) as worker:
            csrf_w = login(worker, "worker@example.com")
            too_long = worker.post(
                "/api/v1/leave-requests",
                json={
                    "leave_type_id": type_id,
                    "start_date": "2026-07-01",
                    "end_date": "2026-07-10",
                },
                headers=csrf_w,
            )
            assert too_long.status_code == 409
            created = worker.post(
                "/api/v1/leave-requests",
                json={
                    "leave_type_id": type_id,
                    "start_date": "2026-07-01",
                    "end_date": "2026-07-03",
                    "reason": "Urlop rodzinny",
                },
                headers=csrf_w,
            )
            assert created.status_code == 201, created.text
            request_id = created.json()["id"]
            assert created.json()["days"] == 3
            assert (
                worker.post(
                    "/api/v1/leave-requests",
                    json={
                        "leave_type_id": type_id,
                        "start_date": "2026-07-02",
                        "end_date": "2026-07-02",
                    },
                    headers=csrf_w,
                ).status_code
                == 409
            )
            assert (
                worker.post(
                    f"/api/v1/leave-requests/{request_id}/decision",
                    json={"approve": True},
                    headers=csrf_w,
                ).status_code
                == 403
            )
        decided = admin.post(
            f"/api/v1/leave-requests/{request_id}/decision", json={"approve": True}, headers=csrf
        )
        assert decided.status_code == 200, decided.text
        assert decided.json()["status"] == "approved"
        assert (
            admin.post(
                f"/api/v1/leave-requests/{request_id}/decision", json={"approve": True}, headers=csrf
            ).status_code
            == 409
        )
        remaining = admin.get(
            f"/api/v1/leave-balances?employee_id={seeded['employee']}&year=2026"
        ).json()
        assert remaining[0]["used_days"] == 3
        assert remaining[0]["remaining_days"] == 2
        assert any(row["action"] == "leave.decision" for row in admin.get("/api/v1/audit-logs").json())


def test_leave_request_balance_decision_and_overlap(seeded):
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        leave_type = admin.post(
            "/api/v1/leave-types", json={"code": "urlop", "name": "Urlop wypoczynkowy"}, headers=csrf
        )
        assert leave_type.status_code == 201, leave_type.text
        type_id = leave_type.json()["id"]
        balance = admin.post(
            "/api/v1/leave-balances",
            json={
                "employee_id": seeded["employee"],
                "leave_type_id": type_id,
                "year": 2026,
                "granted_days": 5,
            },
            headers=csrf,
        )
        assert balance.status_code == 201, balance.text
        assert balance.json()["remaining_days"] == 5
        with TestClient(app) as worker:
            csrf_w = login(worker, "worker@example.com")
            too_long = worker.post(
                "/api/v1/leave-requests",
                json={
                    "leave_type_id": type_id,
                    "start_date": "2026-07-01",
                    "end_date": "2026-07-10",
                    "reason": "Długi urlop",
                },
                headers=csrf_w,
            )
            assert too_long.status_code == 409
            created = worker.post(
                "/api/v1/leave-requests",
                json={
                    "leave_type_id": type_id,
                    "start_date": "2026-07-01",
                    "end_date": "2026-07-03",
                    "reason": "Urlop rodzinny",
                },
                headers=csrf_w,
            )
            assert created.status_code == 201, created.text
            request_id = created.json()["id"]
            assert created.json()["days"] == 3
            assert created.json()["status"] == "pending"
            overlap = worker.post(
                "/api/v1/leave-requests",
                json={
                    "leave_type_id": type_id,
                    "start_date": "2026-07-02",
                    "end_date": "2026-07-04",
                },
                headers=csrf_w,
            )
            assert overlap.status_code == 409
        decided = admin.post(
            f"/api/v1/leave-requests/{request_id}/decision", json={"approve": True}, headers=csrf
        )
        assert decided.status_code == 200, decided.text
        assert decided.json()["status"] == "approved"
        remaining = admin.get(
            f"/api/v1/leave-balances?employee_id={seeded['employee']}&year=2026", headers=csrf
        ).json()
        assert remaining[0]["used_days"] == 3
        assert remaining[0]["remaining_days"] == 2
        assert any(row["action"] == "leave.decision" for row in admin.get("/api/v1/audit-logs").json())


def test_employee_number_auto_sequence(seeded):
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        suggested = admin.get("/api/v1/employees/next-number")
        assert suggested.status_code == 200, suggested.text
        assert suggested.json()["employee_number"] == "0001"
        first = admin.post(
            "/api/v1/employees",
            json={
                "first_name": "Anna",
                "last_name": "Kowalska",
                "email": "anna.seq@example.com",
                "role": "employee",
            },
            headers=csrf,
        )
        assert first.status_code == 201, first.text
        assert first.json()["employee_number"] == "0001"
        assert first.json()["status"] == "invited"
        second = admin.post(
            "/api/v1/employees",
            json={
                "employee_number": "0042",
                "first_name": "Piotr",
                "last_name": "Nowak",
                "email": "piotr.seq@example.com",
                "role": "employee",
            },
            headers=csrf,
        )
        assert second.status_code == 201, second.text
        assert second.json()["employee_number"] == "0042"
        next_after = admin.get("/api/v1/employees/next-number")
        assert next_after.status_code == 200
        assert next_after.json()["employee_number"] == "0043"
        with TestClient(app) as worker:
            login(worker, "worker@example.com")
            assert worker.get("/api/v1/employees/next-number").status_code == 403


def test_team_tags_supervisor_role_and_filters(seeded):
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        tag = admin.post(
            "/api/v1/tags",
            json={"name": "Zmiana A", "color": "#0EA5E9", "is_informational": False},
            headers=csrf,
        )
        assert tag.status_code == 201, tag.text
        body = tag.json()
        tag_id = body["id"]
        assert body["color"] == "#0EA5E9"
        assert body["is_informational"] is False
        assert admin.post("/api/v1/tags", json={"name": "Zmiana A"}, headers=csrf).status_code == 409
        assert (
            admin.post(
                "/api/v1/tags",
                json={"name": "Bad", "color": "#FFFFFF"},
                headers=csrf,
            ).status_code
            == 422
        )
        info = admin.post(
            "/api/v1/tags",
            json={"name": "Wewnętrzny", "color": "#9333EA", "is_informational": True},
            headers=csrf,
        )
        assert info.status_code == 201, info.text
        info_id = info.json()["id"]
        patched = admin.patch(
            f"/api/v1/tags/{tag_id}",
            json={"color": "#22C55E", "is_informational": False},
            headers=csrf,
        )
        assert patched.status_code == 200, patched.text
        assert patched.json()["color"] == "#22C55E"
        created = admin.post(
            "/api/v1/employees",
            json={
                "first_name": "Ewa",
                "last_name": "Manager",
                "email": "ewa.manager@example.com",
                "role": "employee",
                "position": "Kierownik zmianowy",
                "tag_ids": [tag_id, info_id],
                "supervisor_id": seeded["employee"],
            },
            headers=csrf,
        )
        assert created.status_code == 201, created.text
        emp = created.json()
        assert emp["tags"][0]["name"] in {"Zmiana A", "Wewnętrzny"}
        assert {t["name"] for t in emp["tags"]} == {"Zmiana A", "Wewnętrzny"}
        assert emp["supervisor_id"] == seeded["employee"]
        assert emp["supervisor_name"]
        admin_tags = {row["id"] for row in admin.get("/api/v1/tags").json()}
        assert tag_id in admin_tags and info_id in admin_tags
        with TestClient(app) as worker:
            worker_csrf = login(worker, "worker@example.com")
            assert worker.post("/api/v1/tags", json={"name": "X"}, headers=worker_csrf).status_code == 403
            worker_tags = worker.get("/api/v1/tags").json()
            assert all(not row["is_informational"] for row in worker_tags)
            assert info_id not in {row["id"] for row in worker_tags}
            own = worker.get(f"/api/v1/employees/{seeded['employee']}")
            assert own.status_code == 200
            # informacyjny jeszcze nie przypisany do workera — lista tagów org już bez info
        assert (
            admin.patch(
                f"/api/v1/employees/{emp['id']}",
                json={"supervisor_id": emp["id"]},
                headers=csrf,
            ).status_code
            == 422
        )
        linked = admin.patch(
            f"/api/v1/employees/{seeded['employee']}",
            json={"role": "manager", "tag_ids": [tag_id]},
            headers=csrf,
        )
        assert linked.status_code == 200, linked.text
        assert "manager" in linked.json()["roles"]
        filtered = admin.get(f"/api/v1/employees?tag_id={tag_id}&role=manager&status=active")
        assert filtered.status_code == 200
        ids = {row["id"] for row in filtered.json()}
        assert seeded["employee"] in ids
        by_position = admin.get("/api/v1/employees?position=Kierownik%20zmianowy")
        assert any(row["id"] == emp["id"] for row in by_position.json())
        assert emp["status"] == "invited"
        assert any(row["id"] == emp["id"] for row in admin.get("/api/v1/employees?status=active").json())
        resent = admin.post(f"/api/v1/employees/{emp['id']}/resend-invite", headers=csrf)
        assert resent.status_code == 200, resent.text
        assert resent.json()["ok"] is True
        deactivated = admin.patch(
            f"/api/v1/employees/{emp['id']}", json={"active": False}, headers=csrf
        )
        assert deactivated.status_code == 200
        assert deactivated.json()["status"] == "inactive"
        assert admin.delete(f"/api/v1/employees/{emp['id']}", headers=csrf).status_code == 204
        assert admin.get(f"/api/v1/employees/{emp['id']}").status_code == 404


def test_create_employee_requires_email(seeded):
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        missing = admin.post(
            "/api/v1/employees",
            json={"first_name": "Bez", "last_name": "Maila"},
            headers=csrf,
        )
        assert missing.status_code == 422
