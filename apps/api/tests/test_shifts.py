from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app
from helpers import login


def test_shifts_draft_publish_overlap_and_visibility(seeded):
    start = datetime(2026, 10, 26, 8, 0, tzinfo=timezone.utc)
    end = start + timedelta(hours=8)
    overlap_end = start + timedelta(hours=4)
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        draft = admin.post(
            "/api/v1/shifts",
            json={
                "employee_id": seeded["employee"],
                "started_at": start.isoformat(),
                "ended_at": end.isoformat(),
                "kind": "standard",
            },
            headers=csrf,
        )
        assert draft.status_code == 201, draft.text
        shift_id = draft.json()["id"]
        assert draft.json()["published"] is False
        assert draft.json()["kind"] == "standard"
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
                json={
                    "employee_id": seeded["foreign"],
                    "started_at": start.isoformat(),
                    "ended_at": end.isoformat(),
                },
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


def test_shifts_replaces_publish_and_reject(seeded):
    start = datetime(2026, 11, 2, 8, 0, tzinfo=timezone.utc)
    end = start + timedelta(hours=8)
    new_end = start + timedelta(hours=9)
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        first = admin.post(
            "/api/v1/shifts",
            json={
                "employee_id": seeded["employee"],
                "started_at": start.isoformat(),
                "ended_at": end.isoformat(),
            },
            headers=csrf,
        )
        assert first.status_code == 201, first.text
        published_id = first.json()["id"]
        assert admin.post("/api/v1/shifts/publish", json={"shift_ids": [published_id]}, headers=csrf).status_code == 200

        draft = admin.post(
            "/api/v1/shifts",
            json={
                "employee_id": seeded["employee"],
                "started_at": start.isoformat(),
                "ended_at": new_end.isoformat(),
                "replaces_id": published_id,
                "kind": "flexible",
                "flags": {"count_before": True},
            },
            headers=csrf,
        )
        assert draft.status_code == 201, draft.text
        draft_id = draft.json()["id"]
        assert draft.json()["replaces_id"] == published_id

        planner_view = admin.get("/api/v1/shifts?include_drafts=true").json()
        ids = {row["id"] for row in planner_view}
        assert draft_id in ids
        assert published_id not in ids

        with TestClient(app) as worker:
            login(worker, "worker@example.com")
            visible = worker.get("/api/v1/shifts").json()
            assert len(visible) == 1
            assert visible[0]["id"] == published_id

        rejected = admin.post("/api/v1/shifts/reject-drafts", json={"shift_ids": [draft_id]}, headers=csrf)
        assert rejected.status_code == 200, rejected.text
        assert draft_id in rejected.json()["removed"]

        planner_after = admin.get("/api/v1/shifts?include_drafts=true").json()
        assert {row["id"] for row in planner_after} == {published_id}

        draft2 = admin.post(
            "/api/v1/shifts",
            json={
                "employee_id": seeded["employee"],
                "started_at": start.isoformat(),
                "ended_at": new_end.isoformat(),
                "replaces_id": published_id,
            },
            headers=csrf,
        )
        assert draft2.status_code == 201, draft2.text
        draft2_id = draft2.json()["id"]
        pub = admin.post("/api/v1/shifts/publish", json={"shift_ids": [draft2_id]}, headers=csrf)
        assert pub.status_code == 200, pub.text
        assert pub.json()[0]["published"] is True

        with TestClient(app) as worker:
            login(worker, "worker@example.com")
            visible = worker.get("/api/v1/shifts").json()
            assert len(visible) == 1
            assert visible[0]["id"] == draft2_id

        old = admin.get(f"/api/v1/shifts?include_drafts=true").json()
        assert published_id not in {row["id"] for row in old}


def test_shifts_bulk_and_day_type(seeded):
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        bulk = admin.post(
            "/api/v1/shifts/bulk",
            json={
                "employee_ids": [seeded["employee"]],
                "kind": "standard",
                "started_time": "08:00",
                "ended_time": "16:00",
                "weekdays": [0, 1, 2, 3, 4],
                "from_date": "2026-11-02",
                "to_date": "2026-11-06",
                "skip_holidays": False,
            },
            headers=csrf,
        )
        assert bulk.status_code == 201, bulk.text
        assert bulk.json()["count"] == 5

        day = admin.put(
            "/api/v1/calendar/day-types",
            json={"employee_id": seeded["employee"], "day": "2026-11-07", "code": "TP5"},
            headers=csrf,
        )
        assert day.status_code == 200, day.text
        assert day.json()["code"] == "TP5"

        listed = admin.get(
            "/api/v1/calendar/day-types?from=2026-11-01&to=2026-11-30&employee_id=" + seeded["employee"]
        ).json()
        assert any(row["code"] == "TP5" for row in listed)

        forbidden = admin.put(
            "/api/v1/calendar/availability",
            json={
                "employee_id": seeded["employee"],
                "day": "2026-11-07",
                "status": "hours",
                "start_minute": 600,
                "end_minute": 900,
            },
            headers=csrf,
        )
        assert forbidden.status_code == 403, forbidden.text

    with TestClient(app) as worker:
        csrf = login(worker, "worker@example.com")
        avail = worker.put(
            "/api/v1/calendar/availability",
            json={
                "employee_id": seeded["employee"],
                "day": "2026-11-07",
                "status": "hours",
                "start_minute": 600,
                "end_minute": 900,
            },
            headers=csrf,
        )
        assert avail.status_code == 200, avail.text
        assert avail.json()["status"] == "hours"


def test_default_day_type_code():
    from datetime import date

    from app.shifts import default_day_type_code

    assert default_day_type_code(date(2026, 11, 2)) == "P"  # Mon
    assert default_day_type_code(date(2026, 11, 6)) == "P"  # Fri
    assert default_day_type_code(date(2026, 11, 7)) == "TP5"  # Sat
    assert default_day_type_code(date(2026, 11, 8)) == "ND"  # Sun
