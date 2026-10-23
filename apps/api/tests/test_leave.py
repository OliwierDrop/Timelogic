from fastapi.testclient import TestClient

from app.main import app
from helpers import login

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


def test_request_limits_ensure_and_put(seeded):
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        types = admin.get("/api/v1/leave-types")
        assert types.status_code == 200, types.text
        codes = {row["code"] for row in types.json()}
        assert "uw" in codes
        assert "pz" in codes
        assert any(row["category"] == "leave" for row in types.json())
        assert any(row["code"] == "pz" and row["category"] == "custom" for row in types.json())

        employee_id = seeded["employee"]
        empty = admin.get(f"/api/v1/employees/{employee_id}/request-limits")
        assert empty.status_code == 200, empty.text
        assert empty.json()["leave"] == []
        assert empty.json()["custom"] == []

        saved = admin.put(
            f"/api/v1/employees/{employee_id}/request-limits",
            json=[
                {
                    "code": "uw",
                    "year": 2026,
                    "granted_days": 26,
                    "unlimited": False,
                    "carry_over": True,
                    "period": None,
                },
                {
                    "code": "pz",
                    "year": 2026,
                    "granted_days": 0,
                    "unlimited": True,
                    "carry_over": False,
                    "period": None,
                },
            ],
            headers=csrf,
        )
        assert saved.status_code == 200, saved.text
        body = saved.json()
        assert body["leave_years"] == [2026]
        assert body["custom_years"] == [2026]
        leave = next(row for row in body["leave"] if row["leave_type_code"] == "uw")
        assert leave["granted_days"] == 26
        assert leave["carry_over"] is True
        assert leave["unlimited"] is False
        custom = next(row for row in body["custom"] if row["leave_type_code"] == "pz")
        assert custom["unlimited"] is True
        assert custom["period"] is None

        limited_pz = admin.put(
            f"/api/v1/employees/{employee_id}/request-limits",
            json=[
                {
                    "code": "pz",
                    "year": 2026,
                    "granted_days": 8,
                    "unlimited": False,
                    "carry_over": False,
                    "period": "month",
                }
            ],
            headers=csrf,
        )
        assert limited_pz.status_code == 200, limited_pz.text
        pz = limited_pz.json()["custom"][0]
        assert pz["granted_days"] == 8
        assert pz["unlimited"] is False
        assert pz["period"] == "month"


def test_employment_terms_gate_leave_requests(seeded):
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        employee_id = seeded["employee"]
        terms = admin.put(
            f"/api/v1/employees/{employee_id}/employment-terms",
            json=[
                {
                    "effective_from": "2026-07-01",
                    "contract_type": "mandate",
                    "daily_minutes": 0,
                },
                {
                    "effective_from": "2026-11-01",
                    "contract_type": "employment",
                    "daily_minutes": 240,
                },
            ],
            headers=csrf,
        )
        assert terms.status_code == 200, terms.text
        assert len(terms.json()) == 2
        assert terms.json()[1]["daily_minutes"] == 240

        leave_type = admin.post(
            "/api/v1/leave-types",
            json={"code": "testuw", "name": "Test urlop", "category": "leave"},
            headers=csrf,
        )
        assert leave_type.status_code == 201, leave_type.text
        type_id = leave_type.json()["id"]

        with TestClient(app) as worker:
            csrf_w = login(worker, "worker@example.com")
            blocked = worker.post(
                "/api/v1/leave-requests",
                json={
                    "leave_type_id": type_id,
                    "start_date": "2026-08-10",
                    "end_date": "2026-08-11",
                },
                headers=csrf_w,
            )
            assert blocked.status_code == 422
            allowed = worker.post(
                "/api/v1/leave-requests",
                json={
                    "leave_type_id": type_id,
                    "start_date": "2026-11-10",
                    "end_date": "2026-11-11",
                },
                headers=csrf_w,
            )
            assert allowed.status_code == 201, allowed.text


