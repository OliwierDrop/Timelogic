"""Organization profile, SMTP settings, admin-only."""

from __future__ import annotations

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from .auth import public_origin
from .db import get_db
from .mail_settings import (
    decrypt_smtp_password,
    deliver_mail,
    encrypt_smtp_password,
    get_organization,
    mail_view,
)
from .models import Organization, User
from .security import current_user, require_role

router = APIRouter(prefix="/organization", tags=["Organizacja"])

COMMON_TIMEZONES = (
    "Europe/Warsaw",
    "Europe/Berlin",
    "Europe/Prague",
    "Europe/Vienna",
    "Europe/Budapest",
    "Europe/Vilnius",
    "Europe/Riga",
    "Europe/Tallinn",
    "Europe/Kyiv",
    "Europe/London",
    "UTC",
)


def _org_or_404(db: Session, user: User) -> Organization:
    org = get_organization(db, user.organization_id)
    if not org:
        raise HTTPException(404, "Nie znaleziono organizacji")
    return org


def _validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(422, "Nieprawidłowa strefa czasowa") from exc
    return value


def organization_view(org: Organization) -> dict:
    return {
        "id": str(org.id),
        "name": org.name,
        "timezone": org.timezone,
        "public_origin": public_origin(),
        "timezones": list(COMMON_TIMEZONES),
    }


@router.get("")
def get_org(user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin")
    return organization_view(_org_or_404(db, user))


class OrganizationPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)


@router.patch("")
def patch_org(
    data: OrganizationPatch,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_role(db, user, "admin")
    org = _org_or_404(db, user)
    if data.name is not None:
        org.name = data.name.strip()
        if not org.name:
            raise HTTPException(422, "Nazwa nie może być pusta")
    if data.timezone is not None:
        org.timezone = _validate_timezone(data.timezone.strip())
    from .main import audit

    audit(db, user, "organization.update", "organization", org.id, {"name": org.name, "timezone": org.timezone})
    db.commit()
    db.refresh(org)
    return organization_view(org)


@router.get("/mail")
def get_mail(user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin")
    org = _org_or_404(db, user)
    db.commit()  # persist env seed if any
    return mail_view(org)


class MailPut(BaseModel):
    host: str = Field(default="", max_length=255)
    port: int = Field(default=587, ge=1, le=65535)
    from_address: str = Field(default="", max_length=320)
    starttls: bool = False
    username: str = Field(default="", max_length=320)
    password: str | None = Field(default=None, max_length=500)


@router.put("/mail")
def put_mail(
    data: MailPut,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_role(db, user, "admin")
    org = _org_or_404(db, user)
    host = data.host.strip()
    if not host:
        org.smtp_host = None
        org.smtp_port = None
        org.smtp_from = None
        org.smtp_starttls = False
        org.smtp_user = None
        org.smtp_password_enc = None
    else:
        org.smtp_host = host
        org.smtp_port = data.port
        org.smtp_from = data.from_address.strip() or None
        org.smtp_starttls = data.starttls
        org.smtp_user = data.username.strip() or None
        if data.password is not None and data.password != "":
            try:
                org.smtp_password_enc = encrypt_smtp_password(data.password)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
    from .main import audit

    audit(
        db,
        user,
        "organization.mail.update",
        "organization",
        org.id,
        {"host": org.smtp_host, "configured": bool(org.smtp_host)},
    )
    db.commit()
    db.refresh(org)
    return mail_view(org)


class MailTestIn(BaseModel):
    to: EmailStr


@router.post("/mail/test")
def test_mail(
    data: MailTestIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_role(db, user, "admin")
    org = _org_or_404(db, user)
    if not org.smtp_host:
        raise HTTPException(422, "Najpierw skonfiguruj SMTP")
    password = decrypt_smtp_password(org.smtp_password_enc)
    try:
        deliver_mail(
            host=org.smtp_host,
            port=int(org.smtp_port or 25),
            from_address=org.smtp_from or "timelogic@localhost",
            starttls=bool(org.smtp_starttls),
            username=org.smtp_user,
            password=password,
            to=str(data.to),
            subject="TimeLogic — test poczty",
            body=(
                "To jest wiadomość testowa z ustawień organizacji TimeLogic.\n\n"
                "Jeśli ją widzisz, konfiguracja SMTP działa.\n"
            ),
        )
    except Exception as exc:
        raise HTTPException(502, f"Nie udało się wysłać: {exc}") from exc
    return {"ok": True}
