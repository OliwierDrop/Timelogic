"""Kartoteka dokumentów pracownika — upload lokalny na dysk."""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path, PurePosixPath
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import EmployeeDocument, User
from .security import current_user, employee_or_404, require_role

router = APIRouter(tags=["Dokumenty"])

MAX_BYTES = 15 * 1024 * 1024
ALLOWED_CATEGORIES = frozenset(
    {"benefit", "certificate", "diploma", "employment_certificate", "contract", "other"}
)
ALLOWED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}
ALLOWED_CONTENT_TYPES = frozenset(ALLOWED_EXTENSIONS.values())


def upload_root() -> Path:
    root = Path(os.getenv("UPLOAD_DIR", "/data/uploads"))
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_filename(name: str) -> str:
    base = PurePosixPath(name.replace("\\", "/")).name.strip() or "plik"
    return re.sub(r"[^\w.\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ ]+", "_", base)[:200]


def resolve_extension(filename: str, content_type: str | None) -> tuple[str, str]:
    ext = Path(filename).suffix.lower()
    if ext in ALLOWED_EXTENSIONS:
        return ext, ALLOWED_EXTENSIONS[ext]
    if content_type in ALLOWED_CONTENT_TYPES:
        for candidate, mime in ALLOWED_EXTENSIONS.items():
            if mime == content_type:
                return candidate, mime
    raise HTTPException(422, "Dozwolone formaty: PDF, JPG, JPEG, PNG")


def document_view(row: EmployeeDocument) -> dict:
    return {
        "id": str(row.id),
        "employee_id": str(row.employee_id),
        "category": row.category,
        "name": row.name,
        "description": row.description,
        "note": row.note,
        "original_filename": row.original_filename,
        "content_type": row.content_type,
        "size_bytes": row.size_bytes,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def audit(db: Session, user: User, action: str, kind: str, target: UUID, detail=None):
    from .main import audit as write_audit

    write_audit(db, user, action, kind, target, detail)


@router.get("/employees/{employee_id}/documents")
def list_documents(
    employee_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    employee_or_404(db, user, employee_id)
    rows = db.scalars(
        select(EmployeeDocument)
        .where(EmployeeDocument.employee_id == employee_id)
        .order_by(EmployeeDocument.created_at.desc(), EmployeeDocument.id.desc())
    ).all()
    return [document_view(row) for row in rows]


@router.post("/employees/{employee_id}/documents", status_code=201)
async def create_document(
    employee_id: UUID,
    file: UploadFile = File(...),
    category: str = Form(...),
    name: str = Form(...),
    description: str | None = Form(default=None),
    note: str | None = Form(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_role(db, user, "admin", "hr")
    employee = employee_or_404(db, user, employee_id, manage=True)
    category_code = category.strip().lower()
    if category_code not in ALLOWED_CATEGORIES:
        raise HTTPException(422, "Nieprawidłowa kategoria")
    title = (name or "").strip()
    if not title:
        raise HTTPException(422, "Podaj nazwę dokumentu")
    if len(title) > 200:
        raise HTTPException(422, "Nazwa jest zbyt długa")
    desc = (description or "").strip() or None
    if desc and len(desc) > 500:
        raise HTTPException(422, "Opis jest zbyt długi")
    note_text = (note or "").strip() or None

    original = safe_filename(file.filename or "plik")
    ext, expected_mime = resolve_extension(original, file.content_type)
    data = await file.read(MAX_BYTES + 1)
    if len(data) == 0:
        raise HTTPException(422, "Plik jest pusty")
    if len(data) > MAX_BYTES:
        raise HTTPException(422, "Maksymalny rozmiar pliku to 15 MB")
    content_type = file.content_type or expected_mime
    if content_type not in ALLOWED_CONTENT_TYPES and content_type != expected_mime:
        # akceptuj gdy rozszerzenie OK, a przeglądarka poda application/octet-stream
        if content_type not in ("application/octet-stream", "binary/octet-stream"):
            raise HTTPException(422, "Dozwolone formaty: PDF, JPG, JPEG, PNG")
        content_type = expected_mime

    doc_id = uuid.uuid4()
    relative = PurePosixPath(str(employee.organization_id), str(employee_id), f"{doc_id}{ext}")
    absolute = upload_root() / relative
    absolute.parent.mkdir(parents=True, exist_ok=True)
    absolute.write_bytes(data)

    row = EmployeeDocument(
        id=doc_id,
        employee_id=employee_id,
        category=category_code,
        name=title,
        description=desc,
        note=note_text,
        original_filename=original,
        content_type=content_type,
        size_bytes=len(data),
        storage_key=str(relative),
        created_by=user.id,
    )
    db.add(row)
    audit(
        db,
        user,
        "document.create",
        "employee_document",
        doc_id,
        {"employee_id": str(employee_id), "category": category_code, "name": title},
    )
    db.commit()
    db.refresh(row)
    return document_view(row)


class DocumentPatch(BaseModel):
    category: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    note: str | None = None


@router.patch("/employees/{employee_id}/documents/{document_id}")
def patch_document(
    employee_id: UUID,
    document_id: UUID,
    data: DocumentPatch,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_role(db, user, "admin", "hr")
    employee_or_404(db, user, employee_id, manage=True)
    row = db.scalar(
        select(EmployeeDocument).where(
            EmployeeDocument.id == document_id, EmployeeDocument.employee_id == employee_id
        )
    )
    if not row:
        raise HTTPException(404, "Nie znaleziono dokumentu")
    payload = data.model_dump(exclude_unset=True)
    if "category" in payload:
        category_code = str(payload["category"] or "").strip().lower()
        if category_code not in ALLOWED_CATEGORIES:
            raise HTTPException(422, "Nieprawidłowa kategoria")
        row.category = category_code
    if "name" in payload:
        title = str(payload["name"] or "").strip()
        if not title:
            raise HTTPException(422, "Podaj nazwę dokumentu")
        row.name = title
    if "description" in payload:
        desc = (payload["description"] or "").strip() if payload["description"] is not None else ""
        row.description = desc or None
    if "note" in payload:
        note_text = (payload["note"] or "").strip() if payload["note"] is not None else ""
        row.note = note_text or None
    audit(
        db,
        user,
        "document.update",
        "employee_document",
        document_id,
        {"employee_id": str(employee_id), "fields": sorted(payload.keys())},
    )
    db.commit()
    db.refresh(row)
    return document_view(row)


@router.get("/employees/{employee_id}/documents/{document_id}/file")
def download_document(
    employee_id: UUID,
    document_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    employee_or_404(db, user, employee_id)
    row = db.scalar(
        select(EmployeeDocument).where(
            EmployeeDocument.id == document_id, EmployeeDocument.employee_id == employee_id
        )
    )
    if not row:
        raise HTTPException(404, "Nie znaleziono dokumentu")
    path = upload_root() / row.storage_key
    if not path.is_file():
        raise HTTPException(404, "Plik nie istnieje na dysku")
    return FileResponse(
        path,
        media_type=row.content_type,
        filename=row.original_filename,
        content_disposition_type="attachment",
    )


@router.delete("/employees/{employee_id}/documents/{document_id}", status_code=204)
def delete_document(
    employee_id: UUID,
    document_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_role(db, user, "admin", "hr")
    employee_or_404(db, user, employee_id, manage=True)
    row = db.scalar(
        select(EmployeeDocument).where(
            EmployeeDocument.id == document_id, EmployeeDocument.employee_id == employee_id
        )
    )
    if not row:
        raise HTTPException(404, "Nie znaleziono dokumentu")
    path = upload_root() / row.storage_key
    audit(
        db,
        user,
        "document.delete",
        "employee_document",
        document_id,
        {"employee_id": str(employee_id), "name": row.name},
    )
    db.delete(row)
    db.commit()
    if path.is_file():
        path.unlink(missing_ok=True)
    return None
