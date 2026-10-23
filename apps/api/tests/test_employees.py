from fastapi.testclient import TestClient

from app.main import app
from helpers import login

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


