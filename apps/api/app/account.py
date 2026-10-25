"""Self-service account: profile, password, 2FA, preferences."""

from __future__ import annotations

import base64
import io
import secrets
from datetime import timedelta
from typing import Literal
from uuid import UUID

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .db import get_db
from .models import AuthToken, Session as LoginSession, User, UserPreferences
from .security import current_user, digest, hashing, now, own_employee

router = APIRouter(prefix="/auth", tags=["Konto"])

TimeFormat = Literal["h24", "h12"]
DateFormat = Literal["dmy", "ymd", "mdy"]
WeekStarts = Literal["monday", "sunday"]
Theme = Literal["system", "light", "dark"]

DEFAULT_PREFS = {
    "time_format": "h24",
    "date_format": "dmy",
    "week_starts_on": "monday",
    "theme": "system",
}


def preferences_view(row: UserPreferences | None):
    if not row:
        return dict(DEFAULT_PREFS)
    return {
        "time_format": row.time_format,
        "date_format": row.date_format,
        "week_starts_on": row.week_starts_on,
        "theme": row.theme,
    }


def get_or_create_preferences(db: Session, user_id: UUID) -> UserPreferences:
    row = db.get(UserPreferences, user_id)
    if row:
        return row
    row = UserPreferences(user_id=user_id, **DEFAULT_PREFS)
    db.add(row)
    db.flush()
    return row


def account_security_view(user: User):
    return {
        "totp_enabled": user.totp_enabled_at is not None,
        "email_otp_enabled": bool(user.email_otp_enabled),
    }


def enrich_user_view(db: Session, user: User, base: dict) -> dict:
    own = own_employee(db, user)
    prefs = db.get(UserPreferences, user.id)
    base.update(
        {
            "phone": own.phone if own else None,
            "pending_email": user.pending_email,
            "security": account_security_view(user),
            "preferences": preferences_view(prefs),
        }
    )
    return base


def twofa_required(user: User) -> bool:
    return user.totp_enabled_at is not None or bool(user.email_otp_enabled)


def issue_login_2fa_challenge(db: Session, user: User) -> str:
    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == "login_2fa",
            AuthToken.used_at.is_(None),
        )
        .values(used_at=now())
    )
    token = secrets.token_urlsafe(32)
    db.add(
        AuthToken(
            user_id=user.id,
            purpose="login_2fa",
            token_hash=digest(token),
            expires_at=now() + timedelta(minutes=5),
        )
    )
    return token


def _issue_email_otp(db: Session, user: User, *, purpose: str, subject: str) -> tuple[bool, str]:
    from .auth import send_mail

    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
        )
        .values(used_at=now())
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        AuthToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=digest(code),
            expires_at=now() + timedelta(minutes=10),
        )
    )
    sent = send_mail(
        user.email,
        subject,
        code,
        body=f"Twój kod jednorazowy do TimeLogic: {code}\n\nKod jest ważny 10 minut.\n",
    )
    return sent, code


def send_email_otp(db: Session, user: User) -> None:
    _issue_email_otp(db, user, purpose="email_otp", subject="Kod logowania TimeLogic")


def verify_email_otp(db: Session, user: User, code: str, *, purpose: str = "email_otp") -> bool:
    row = db.scalar(
        select(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == purpose,
            AuthToken.token_hash == digest(code.strip()),
            AuthToken.used_at.is_(None),
            AuthToken.expires_at > now(),
        )
        .with_for_update()
    )
    if not row:
        return False
    row.used_at = now()
    return True


def require_password(user: User, password: str) -> None:
    if not user.password_hash or not hashing.verify(password, user.password_hash):
        raise HTTPException(400, "Nieprawidłowe hasło")


def revoke_other_sessions(db: Session, user: User, request: Request) -> None:
    current = getattr(request.state, "login_session", None)
    statement = update(LoginSession).where(
        LoginSession.user_id == user.id,
        LoginSession.revoked_at.is_(None),
    )
    if current is not None:
        statement = statement.where(LoginSession.id != current.id)
    db.execute(statement.values(revoked_at=now()))


def qr_png_base64(otpauth_uri: str) -> str:
    image = qrcode.make(otpauth_uri)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


class ProfilePatch(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None


@router.patch("/me/profile")
def patch_profile(data: ProfilePatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    from .auth import user_view
    from .employees import request_email_change
    from .main import audit

    own = own_employee(db, user)
    payload = data.model_dump(exclude_unset=True)
    email_was_set = "email" in data.model_fields_set
    email_value = payload.pop("email", None)

    if any(key in payload for key in ("first_name", "last_name", "phone")) and not own:
        raise HTTPException(422, "Brak karty pracownika — połącz konto w module Zespół")

    if own:
        if "first_name" in payload and payload["first_name"] is not None:
            own.first_name = payload["first_name"].strip()
        if "last_name" in payload and payload["last_name"] is not None:
            own.last_name = payload["last_name"].strip()
        if "phone" in payload:
            phone = (payload["phone"] or "").strip()
            own.phone = phone or None

    email_change = None
    if email_was_set:
        if email_value is None:
            raise HTTPException(422, "Podaj adres e-mail")
        if not own:
            raise HTTPException(422, "Zmiana e-maila wymaga karty pracownika")
        email_change = request_email_change(db, user, own, str(email_value))

    audit(db, user, "account.profile_update", "user", user.id)
    db.commit()
    db.refresh(user)
    result = enrich_user_view(db, user, user_view(db, user))
    if email_change:
        result["email_change"] = email_change
    return {"user": result}


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


@router.post("/me/password")
def change_password(
    data: PasswordChangeIn,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    from .main import audit

    if not user.password_hash or not hashing.verify(data.current_password, user.password_hash):
        raise HTTPException(400, "Nieprawidłowe obecne hasło")
    if data.current_password == data.new_password:
        raise HTTPException(422, "Nowe hasło musi być inne niż obecne")
    user.password_hash = hashing.hash(data.new_password)
    revoke_other_sessions(db, user, request)
    audit(db, user, "account.password_change", "user", user.id)
    db.commit()
    return {"ok": True}


@router.get("/me/preferences")
def get_preferences(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return preferences_view(db.get(UserPreferences, user.id))


class PreferencesPatch(BaseModel):
    time_format: TimeFormat | None = None
    date_format: DateFormat | None = None
    week_starts_on: WeekStarts | None = None
    theme: Theme | None = None


@router.patch("/me/preferences")
def patch_preferences(
    data: PreferencesPatch, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    from .main import audit

    row = get_or_create_preferences(db, user.id)
    payload = data.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(row, key, value)
    audit(db, user, "account.preferences_update", "user", user.id, payload)
    db.commit()
    return preferences_view(row)


class PasswordGateIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)


@router.post("/me/2fa/totp/setup")
def totp_setup(
    data: PasswordGateIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    require_password(user, data.password)
    if user.totp_enabled_at is not None:
        raise HTTPException(409, "2FA aplikacji jest już włączone")
    secret = pyotp.random_base32()
    user.totp_secret = secret
    db.commit()
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="TimeLogic")
    return {
        "secret": secret,
        "otpauth_uri": uri,
        "qr_png_base64": qr_png_base64(uri),
    }


class TotpConfirmIn(BaseModel):
    code: str = Field(min_length=6, max_length=8)


@router.post("/me/2fa/totp/confirm")
def totp_confirm(
    data: TotpConfirmIn,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    from .main import audit

    if not user.totp_secret:
        raise HTTPException(400, "Najpierw uruchom konfigurację 2FA")
    if user.totp_enabled_at is not None:
        raise HTTPException(409, "2FA aplikacji jest już włączone")
    if not pyotp.TOTP(user.totp_secret).verify(data.code.strip(), valid_window=1):
        raise HTTPException(400, "Nieprawidłowy kod")
    user.totp_enabled_at = now()
    revoke_other_sessions(db, user, request)
    audit(db, user, "account.totp_enable", "user", user.id)
    db.commit()
    return account_security_view(user)


class TotpDisableIn(BaseModel):
    password: str | None = None
    code: str | None = None


@router.post("/me/2fa/totp/disable")
def totp_disable(data: TotpDisableIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    from .main import audit

    if user.totp_enabled_at is None:
        return account_security_view(user)
    ok = False
    if data.password and user.password_hash and hashing.verify(data.password, user.password_hash):
        ok = True
    if data.code and user.totp_secret and pyotp.TOTP(user.totp_secret).verify(data.code.strip(), valid_window=1):
        ok = True
    if not ok:
        raise HTTPException(400, "Podaj hasło lub kod z aplikacji")
    user.totp_secret = None
    user.totp_enabled_at = None
    audit(db, user, "account.totp_disable", "user", user.id)
    db.commit()
    return account_security_view(user)


class EmailOtpCodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=8)


@router.post("/me/2fa/email/setup")
def email_otp_setup(
    data: PasswordGateIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    require_password(user, data.password)
    if user.email_otp_enabled:
        raise HTTPException(409, "2FA e-mail jest już włączone")
    sent, code = _issue_email_otp(
        db,
        user,
        purpose="email_otp_setup",
        subject="Kod weryfikacji 2FA TimeLogic",
    )
    db.commit()
    result = {"ok": True, "email_sent": sent, "email": user.email}
    if not sent:
        result["dev_code"] = code
    return result


@router.post("/me/2fa/email/confirm")
def email_otp_confirm(
    data: EmailOtpCodeIn,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    from .main import audit

    if user.email_otp_enabled:
        raise HTTPException(409, "2FA e-mail jest już włączone")
    if not verify_email_otp(db, user, data.code, purpose="email_otp_setup"):
        raise HTTPException(400, "Nieprawidłowy lub wygasły kod")
    user.email_otp_enabled = True
    revoke_other_sessions(db, user, request)
    audit(db, user, "account.email_otp_enable", "user", user.id)
    db.commit()
    return account_security_view(user)


@router.post("/me/2fa/email/disable")
def email_otp_disable(
    data: PasswordGateIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    from .main import audit

    require_password(user, data.password)
    user.email_otp_enabled = False
    audit(db, user, "account.email_otp_disable", "user", user.id)
    db.commit()
    return account_security_view(user)
