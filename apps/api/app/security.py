import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Employee, Role, Session as LoginSession, User, UserRole


hashing = PasswordHash.recommended()
SESSION_DAYS = 7


def now():
    return datetime.now(timezone.utc)


def digest(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


def issue_session(db: Session, user: User):
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    db.add(
        LoginSession(
            user_id=user.id,
            token_hash=digest(token),
            csrf_hash=digest(csrf),
            expires_at=now() + timedelta(days=SESSION_DAYS),
        )
    )
    db.flush()
    return token, csrf


def current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("tl_session")
    if not token:
        raise HTTPException(401, "Brak sesji")
    row = db.scalar(
        select(LoginSession).where(
            LoginSession.token_hash == digest(token), LoginSession.revoked_at.is_(None), LoginSession.expires_at > now()
        )
    )
    if not row:
        raise HTTPException(401, "Sesja wygasła")
    user = db.get(User, row.user_id)
    if not user or not user.is_active:
        raise HTTPException(401, "Konto nieaktywne")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        csrf = request.headers.get("X-CSRF-Token", "")
        if not secrets.compare_digest(row.csrf_hash, digest(csrf)):
            raise HTTPException(403, "Nieprawidłowy token CSRF")
    request.state.login_session = row
    return user


def role_codes(db: Session, user: User):
    return set(
        db.scalars(
            select(Role.code)
            .join(UserRole, Role.id == UserRole.role_id)
            .where(UserRole.user_id == user.id, Role.organization_id == user.organization_id)
        ).all()
    )


def require_role(db: Session, user: User, *allowed: str):
    if not role_codes(db, user).intersection(allowed):
        raise HTTPException(403, "Brak uprawnienia")


def own_employee(db: Session, user: User):
    return db.scalar(
        select(Employee).where(Employee.organization_id == user.organization_id, Employee.user_id == user.id)
    )


def can_read_employee(db: Session, user: User, employee: Employee):
    if employee.organization_id != user.organization_id:
        return False
    roles = role_codes(db, user)
    if roles.intersection({"admin", "hr"}):
        return True
    if employee.user_id == user.id:
        return True
    if "manager" in roles:
        mine = own_employee(db, user)
        if mine and employee.supervisor_id == mine.id:
            return True
    return False


def can_manage_employee(db: Session, user: User, employee: Employee):
    if employee.organization_id != user.organization_id:
        return False
    roles = role_codes(db, user)
    if roles.intersection({"admin", "hr"}):
        return True
    if "manager" in roles:
        mine = own_employee(db, user)
        if mine and employee.supervisor_id == mine.id:
            return True
    return False


def employee_or_404(db: Session, user: User, employee_id: UUID, manage=False):
    employee = db.get(Employee, employee_id)
    if not employee or not (
        can_manage_employee(db, user, employee) if manage else can_read_employee(db, user, employee)
    ):
        raise HTTPException(404, "Nie znaleziono pracownika")
    return employee


def secure_cookie():
    return os.getenv("COOKIE_SECURE", "true").lower() == "true"
