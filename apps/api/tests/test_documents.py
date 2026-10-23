from io import BytesIO
from pathlib import Path
import os

from fastapi.testclient import TestClient

from app.main import app
from helpers import login

def test_employee_documents_upload_list_download_delete(seeded):
    pdf = b"%PDF-1.4 test document content"
    with TestClient(app) as admin:
        csrf = login(admin, "admin@example.com")
        emp_id = seeded["employee"]
        listed = admin.get(f"/api/v1/employees/{emp_id}/documents")
        assert listed.status_code == 200
        assert listed.json() == []

        bad_type = admin.post(
            f"/api/v1/employees/{emp_id}/documents",
            data={
                "category": "other",
                "name": "Sekret",
            },
            files={"file": ("secret.exe", BytesIO(b"MZ"), "application/octet-stream")},
            headers=csrf,
        )
        assert bad_type.status_code == 422

        too_big = admin.post(
            f"/api/v1/employees/{emp_id}/documents",
            data={"category": "other", "name": "Duzy"},
            files={"file": ("big.pdf", BytesIO(b"x" * (15 * 1024 * 1024 + 1)), "application/pdf")},
            headers=csrf,
        )
        assert too_big.status_code == 422

        created = admin.post(
            f"/api/v1/employees/{emp_id}/documents",
            data={
                "category": "diploma",
                "name": "Karta przebiegu studiów",
                "description": "Przesłane przez uczelnię",
                "note": "",
            },
            files={"file": ("karta.pdf", BytesIO(pdf), "application/pdf")},
            headers=csrf,
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["category"] == "diploma"
        assert body["name"] == "Karta przebiegu studiów"
        assert body["original_filename"] == "karta.pdf"
        doc_id = body["id"]
        stored = list(Path(os.environ["UPLOAD_DIR"]).rglob("*.pdf"))
        assert len(stored) == 1

        rows = admin.get(f"/api/v1/employees/{emp_id}/documents")
        assert rows.status_code == 200
        assert len(rows.json()) == 1
        assert rows.json()[0]["id"] == doc_id

        downloaded = admin.get(f"/api/v1/employees/{emp_id}/documents/{doc_id}/file")
        assert downloaded.status_code == 200
        assert downloaded.content == pdf
        assert "karta.pdf" in downloaded.headers.get("content-disposition", "")

        with TestClient(app) as worker:
            worker_csrf = login(worker, "worker@example.com")
            denied = worker.post(
                f"/api/v1/employees/{emp_id}/documents",
                data={"category": "other", "name": "X"},
                files={"file": ("x.pdf", BytesIO(pdf), "application/pdf")},
                headers=worker_csrf,
            )
            assert denied.status_code == 403
            own_list = worker.get(f"/api/v1/employees/{emp_id}/documents")
            assert own_list.status_code == 200

        deleted = admin.delete(f"/api/v1/employees/{emp_id}/documents/{doc_id}", headers=csrf)
        assert deleted.status_code == 204
        assert admin.get(f"/api/v1/employees/{emp_id}/documents").json() == []
        assert admin.get(f"/api/v1/employees/{emp_id}/documents/{doc_id}/file").status_code == 404
        assert list(Path(os.environ["UPLOAD_DIR"]).rglob("*.pdf")) == []
