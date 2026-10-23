from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app
from helpers import login

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


