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


