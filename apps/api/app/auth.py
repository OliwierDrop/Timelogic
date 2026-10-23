import os
import secrets
import smtplib
from datetime import timedelta
from email.message import EmailMessage
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from .db import get_db
from .models import AuthToken, Role, Session as LoginSession, User, UserRole
from .security import (
    current_user,
    digest,
    hashing,
    issue_session,
    now,
    own_employee,
    require_role,
    role_codes,
    secure_cookie,
)


router = APIRouter(prefix="/auth", tags=["Auth"])


def public_origin() -> str:
    return os.getenv("PUBLIC_ORIGIN", "http://localhost:8080").rstrip("/")


def invite_set_password_url(token: str) -> str:
    return f"{public_origin()}/set-password?token={token}"


def email_confirm_url(token: str) -> str:
    return f"{public_origin()}/confirm-email?token={token}"


def issue_invite_token(db: Session, user_id: UUID) -> str:
    """Unieważnia niewykorzystane tokeny invite i wystawia nowy (7 dni)."""
    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user_id,
            AuthToken.purpose == "invite",
            AuthToken.used_at.is_(None),
        )
        .values(used_at=now())
    )
    token = secrets.token_urlsafe(32)
    db.add(
        AuthToken(
            user_id=user_id,
            purpose="invite",
            token_hash=digest(token),
            expires_at=now() + timedelta(days=7),
        )
    )
    return token


def issue_email_change_token(db: Session, user_id: UUID) -> str:
    """Unieważnia niewykorzystane tokeny email_change i wystawia nowy (48 h)."""
    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user_id,
            AuthToken.purpose == "email_change",
            AuthToken.used_at.is_(None),
        )
        .values(used_at=now())
    )
    token = secrets.token_urlsafe(32)
    db.add(
        AuthToken(
            user_id=user_id,
            purpose="email_change",
            token_hash=digest(token),
            expires_at=now() + timedelta(hours=48),
        )
    )
    return token


def user_view(db: Session, user: User):
    own = own_employee(db, user)
    return {
        "id": str(user.id),
        "email": user.email,
        "roles": sorted(role_codes(db, user)),
        "employee_id": str(own.id) if own else None,
    }


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@router.post("/login")
def login(data: LoginIn, response: Response, request: Request, db: Session = Depends(get_db)):
    from .models import LoginAttempt

    from .main import audit

    email = data.email.lower()
    key = digest(email + ":" + (request.client.host if request.client else "unknown"))
    recent = db.scalar(
        select(func.count())
        .select_from(LoginAttempt)
        .where(LoginAttempt.key_hash == key, LoginAttempt.created_at > now() - timedelta(minutes=15))
    )
    if recent >= 8:
        raise HTTPException(429, "Zbyt wiele prób. Spróbuj później")
    user = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
    if not user or not user.password_hash or not hashing.verify(data.password, user.password_hash):
        db.add(LoginAttempt(key_hash=key))
        db.commit()
        raise HTTPException(401, "Nieprawidłowe dane logowania")
    token, csrf = issue_session(db, user)
    audit(db, user, "auth.login", "user", user.id)
    db.commit()
    response.set_cookie(
        "tl_session", token, httponly=True, secure=secure_cookie(), samesite="lax", max_age=604800, path="/"
    )
    response.set_cookie(
        "tl_csrf", csrf, httponly=False, secure=secure_cookie(), samesite="lax", max_age=604800, path="/"
    )
    return {"csrf_token": csrf, "user": user_view(db, user)}


@router.get("/me")
def me(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    csrf = request.cookies.get("tl_csrf")
    if not csrf or digest(csrf) != request.state.login_session.csrf_hash:
        csrf = None
    return {
        "user": user_view(db, user),
        "csrf_token": csrf,
        "session_expires_at": request.state.login_session.expires_at.isoformat(),
    }


@router.post("/refresh")
def refresh(request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    from .main import audit

    request.state.login_session.revoked_at = now()
    token, csrf = issue_session(db, user)
    audit(db, user, "auth.refresh", "user", user.id)
    db.commit()
    response.set_cookie(
        "tl_session", token, httponly=True, secure=secure_cookie(), samesite="lax", max_age=604800, path="/"
    )
    response.set_cookie(
        "tl_csrf", csrf, httponly=False, secure=secure_cookie(), samesite="lax", max_age=604800, path="/"
    )
    return {"user": user_view(db, user), "csrf_token": csrf}


@router.post("/logout")
def logout(request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    from .main import audit

    request.state.login_session.revoked_at = now()
    audit(db, user, "auth.logout", "user", user.id)
    db.commit()
    response.delete_cookie("tl_session", path="/")
    response.delete_cookie("tl_csrf", path="/")
    return {"ok": True}


def send_mail(to: str, subject: str, url: str, *, body: str | None = None):
    host = os.getenv("SMTP_HOST")
    if not host:
        return False
    message = EmailMessage()
    message["From"] = os.getenv("SMTP_FROM", "timelogic@localhost")
    message["To"] = to
    message["Subject"] = subject
    message.set_content(
        body
        or (
            "Zostałeś zaproszony do TimeLogic.\n\n"
            "Ustaw hasło pod poniższym linkiem (ważny 7 dni). "
            "Hasło wpiszesz dwukrotnie, aby uniknąć pomyłki.\n\n"
            f"{url}\n\n"
            "Po zapisaniu hasła przejdziesz do strony logowania.\n"
        )
    )
    with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "25")), timeout=10) as smtp:
        if os.getenv("SMTP_STARTTLS") == "true":
            smtp.starttls()
        if os.getenv("SMTP_USER"):
            smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        smtp.send_message(message)
    return True


def email_change_mail_body(url: str) -> str:
    return (
        "Otrzymaliśmy prośbę o zmianę adresu e-mail w TimeLogic.\n\n"
        "Potwierdź nowy adres, klikając poniższy link (ważny 48 godzin):\n\n"
        f"{url}\n\n"
        "Jeśli nie prosiłeś o tę zmianę, zignoruj tę wiadomość — "
        "dotychczasowy adres pozostanie bez zmian.\n"
    )


class InviteIn(BaseModel):
    email: EmailStr
    role: str = Field(pattern="^(employee|manager|hr|admin)$")


@router.post("/invite", status_code=201)
def invite(data: InviteIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin")
    email = data.email.lower()
    if db.scalar(select(User.id).where(User.organization_id == user.organization_id, User.email == email)):
        raise HTTPException(409, "Konto już istnieje")
    role = db.scalar(select(Role).where(Role.organization_id == user.organization_id, Role.code == data.role))
    if not role:
        raise HTTPException(422, "Nieprawidłowa rola")
    invited = User(organization_id=user.organization_id, email=email)
    db.add(invited)
    db.flush()
    db.add(UserRole(user_id=invited.id, role_id=role.id))
    token = secrets.token_urlsafe(32)
    db.add(
        AuthToken(user_id=invited.id, purpose="invite", token_hash=digest(token), expires_at=now() + timedelta(days=7))
    )
    from .main import audit

    audit(db, user, "auth.invite", "user", invited.id, {"role": data.role})
    db.commit()
    url = f"{public_origin()}/set-password?token={token}"
    sent = send_mail(email, "Zaproszenie do TimeLogic", url)
    return {"id": str(invited.id), "email_sent": sent, "invite_url": None if sent else url}


@router.get("/users")
def users(user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin")
    rows = db.scalars(select(User).where(User.organization_id == user.organization_id).order_by(User.email)).all()
    return [
        {
            "id": str(row.id),
            "email": row.email,
            "active": row.is_active,
            "roles": list(
                db.scalars(
                    select(Role.code).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == row.id)
                ).all()
            ),
        }
        for row in rows
    ]


class AccessIn(BaseModel):
    active: bool | None = None
    role: str | None = Field(default=None, pattern="^(employee|manager|hr|admin)$")


@router.patch("/users/{user_id}")
def update_access(user_id: UUID, data: AccessIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin")
    target = db.scalar(
        select(User).where(User.id == user_id, User.organization_id == user.organization_id).with_for_update()
    )
    if not target:
        raise HTTPException(404, "Nie znaleziono konta")
    if target.id == user.id and (data.active is False or (data.role and data.role != "admin")):
        raise HTTPException(409, "Nie można usunąć własnego dostępu administratora")
    before = {"active": target.is_active, "roles": sorted(role_codes(db, target))}
    if data.active is not None:
        target.is_active = data.active
        if not data.active:
            db.execute(
                update(LoginSession)
                .where(LoginSession.user_id == target.id, LoginSession.revoked_at.is_(None))
                .values(revoked_at=now())
            )
    if data.role:
        role = db.scalar(select(Role).where(Role.organization_id == user.organization_id, Role.code == data.role))
        db.execute(delete(UserRole).where(UserRole.user_id == target.id))
        db.add(UserRole(user_id=target.id, role_id=role.id))
    from .main import audit

    audit(
        db,
        user,
        "auth.access",
        "user",
        target.id,
        {"before": before, "after": {"active": target.is_active, "role": data.role or before["roles"]}},
    )
    db.commit()
    return {"id": str(target.id), "active": target.is_active, "roles": sorted(role_codes(db, target))}


class PasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=12, max_length=128)


def consume(db: Session, token: str, purpose: str):
    row = db.scalar(
        select(AuthToken)
        .where(
            AuthToken.token_hash == digest(token),
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
            AuthToken.expires_at > now(),
        )
        .with_for_update()
    )
    if not row:
        raise HTTPException(422, "Link jest nieprawidłowy lub wygasł")
    row.used_at = now()
    return db.get(User, row.user_id)


@router.post("/accept-invite")
def accept_invite(data: PasswordIn, db: Session = Depends(get_db)):
    user = consume(db, data.token, "invite")
    user.password_hash = hashing.hash(data.password)
    db.commit()
    return {"ok": True}


class ResetRequest(BaseModel):
    email: EmailStr


@router.post("/request-reset")
def request_reset(data: ResetRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower(), User.is_active.is_(True)))
    if user and os.getenv("SMTP_HOST"):
        token = secrets.token_urlsafe(32)
        db.add(
            AuthToken(
                user_id=user.id, purpose="reset", token_hash=digest(token), expires_at=now() + timedelta(minutes=30)
            )
        )
        db.commit()
        send_mail(
            user.email,
            "Reset hasła TimeLogic",
            f"{public_origin()}/set-password?mode=reset&token={token}",
        )
    return {"ok": True}


@router.post("/reset-password")
def reset_password(data: PasswordIn, db: Session = Depends(get_db)):
    user = consume(db, data.token, "reset")
    user.password_hash = hashing.hash(data.password)
    db.execute(
        update(LoginSession)
        .where(LoginSession.user_id == user.id, LoginSession.revoked_at.is_(None))
        .values(revoked_at=now())
    )
    db.commit()
    return {"ok": True}


class ConfirmEmailIn(BaseModel):
    token: str


@router.post("/confirm-email")
def confirm_email(data: ConfirmEmailIn, db: Session = Depends(get_db)):
    user = consume(db, data.token, "email_change")
    pending = (user.pending_email or "").strip().lower()
    if not pending:
        raise HTTPException(422, "Brak oczekującej zmiany e-maila")
    clash = db.scalar(
        select(User.id).where(
            User.organization_id == user.organization_id,
            User.email == pending,
            User.id != user.id,
        )
    )
    if clash:
        user.pending_email = None
        db.commit()
        raise HTTPException(409, "Ten adres e-mail jest już zajęty")
    user.email = pending
    user.pending_email = None
    invite_url = None
    invite_sent = False
    if user.password_hash is None:
        invite_token = issue_invite_token(db, user.id)
        invite_url = invite_set_password_url(invite_token)
        invite_sent = send_mail(pending, "Zaproszenie do TimeLogic", invite_url)
    db.commit()
    return {
        "ok": True,
        "email": pending,
        "needs_password": user.password_hash is None,
        "invite_sent": invite_sent,
        "invite_url": None if invite_sent else invite_url,
    }
