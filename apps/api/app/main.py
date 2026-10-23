import os
import re
import secrets
from datetime import date, timedelta
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from .db import get_db
from .models import (
    AuditLog,
    AuthToken,
    Employee,
    EmployeeTag,
    Position,
    Role,
    Session as LoginSession,
    Tag,
    User,
    UserRole,
)
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


app = FastAPI(title="TimeLogic API", version="0.1.0")


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code, content={"code": str(exc.status_code), "message": str(exc.detail), "fields": {}}
    )


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    fields = {".".join(map(str, error["loc"])): error["msg"] for error in exc.errors()}
    return JSONResponse(
        status_code=422, content={"code": "422", "message": "Sprawdź dane formularza", "fields": fields}
    )


@app.middleware("http")
async def security_headers(request: Request, call_next):
    origin = request.headers.get("origin")
    allowed = os.getenv("PUBLIC_ORIGIN", "http://localhost:8080")
    if request.method not in ("GET", "HEAD", "OPTIONS") and origin and origin != allowed:
        return JSONResponse(
            status_code=403, content={"code": "origin", "message": "Niedozwolone pochodzenie", "fields": {}}
        )
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response


def audit(db: Session, user: User, action: str, target_type: str, target_id: UUID | None, detail=None):
    db.add(
        AuditLog(
            organization_id=user.organization_id,
            actor_id=user.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            detail=detail or {},
        )
    )


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.scalar(select(func.now()))
    return {"status": "ok"}


@app.post("/api/v1/auth/login")
def login(data: LoginIn, response: Response, request: Request, db: Session = Depends(get_db)):
    from .models import LoginAttempt
    from .security import digest

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


def user_view(db: Session, user: User):
    own = own_employee(db, user)
    return {
        "id": str(user.id),
        "email": user.email,
        "roles": sorted(role_codes(db, user)),
        "employee_id": str(own.id) if own else None,
    }


@app.get("/api/v1/auth/me")
def me(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    # CSRF token is delivered separately on login; on reload obtain it from a short-lived response cookie.
    csrf = request.cookies.get("tl_csrf")
    from .security import digest

    if not csrf or digest(csrf) != request.state.login_session.csrf_hash:
        csrf = None
    return {
        "user": user_view(db, user),
        "csrf_token": csrf,
        "session_expires_at": request.state.login_session.expires_at.isoformat(),
    }


@app.post("/api/v1/auth/refresh")
def refresh(request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
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


@app.post("/api/v1/auth/logout")
def logout(request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    request.state.login_session.revoked_at = now()
    audit(db, user, "auth.logout", "user", user.id)
    db.commit()
    response.delete_cookie("tl_session", path="/")
    response.delete_cookie("tl_csrf", path="/")
    return {"ok": True}


TAG_COLORS = (
    "#94A3B8",
    "#64748B",
    "#475569",
    "#334155",
    "#1E293B",
    "#0F172A",
    "#7DD3FC",
    "#38BDF8",
    "#0EA5E9",
    "#0284C7",
    "#0369A1",
    "#FCA5A5",
    "#F87171",
    "#EF4444",
    "#DC2626",
    "#B91C1C",
    "#7F1D1D",
    "#86EFAC",
    "#4ADE80",
    "#22C55E",
    "#16A34A",
    "#FDE047",
    "#FACC15",
    "#EAB308",
    "#FB923C",
    "#F97316",
    "#C084FC",
    "#A855F7",
    "#9333EA",
    "#F9A8D4",
    "#EC4899",
    "#DB2777",
)
DEFAULT_TAG_COLOR = TAG_COLORS[0]


class TagIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(default=DEFAULT_TAG_COLOR, max_length=7)
    is_informational: bool = False


class TagPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=7)
    is_informational: bool | None = None


class PositionIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class EmployeeIn(BaseModel):
    employee_number: str | None = Field(default=None, max_length=40)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    position_id: UUID | None = None
    position: str | None = Field(default=None, max_length=120)
    user_id: UUID | None = None
    supervisor_id: UUID | None = None
    tag_ids: list[UUID] | None = None
    role: str = Field(default="employee", pattern="^(employee|manager|hr|admin)$")
    hired_on: date | None = None
    ended_on: date | None = None

    @model_validator(mode="after")
    def require_email_or_account(self):
        if not self.email and not self.user_id:
            raise ValueError("E-mail jest wymagany")
        return self


def next_employee_number(db: Session, organization_id: UUID) -> str:
    """Kolejny numer sekwencyjny (0001, 0002…) na podstawie istniejących numerów cyfrowych."""
    existing = db.scalars(select(Employee.employee_number).where(Employee.organization_id == organization_id)).all()
    used = {value.strip() for value in existing if value and value.strip()}
    max_n = 0
    width = 4
    for value in used:
        if re.fullmatch(r"\d+", value):
            max_n = max(max_n, int(value))
            width = max(width, len(value))
    candidate = max_n + 1
    while True:
        suggestion = str(candidate).zfill(width)
        if suggestion not in used:
            return suggestion
        candidate += 1


class EmployeePatch(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=32)
    position_id: UUID | None = None
    position: str | None = Field(default=None, max_length=120)
    user_id: UUID | None = None
    supervisor_id: UUID | None = None
    tag_ids: list[UUID] | None = None
    role: str | None = Field(default=None, pattern="^(employee|manager|hr|admin)$")
    active: bool | None = None
    hired_on: date | None = None
    ended_on: date | None = None


def resolve_position(
    db: Session,
    user: User,
    *,
    position_id: UUID | None = None,
    position: str | None = None,
    create_missing: bool = False,
) -> tuple[UUID | None, str | None]:
    if position_id is not None:
        row = db.scalar(
            select(Position).where(Position.id == position_id, Position.organization_id == user.organization_id)
        )
        if not row:
            raise HTTPException(422, "Nieprawidłowe stanowisko")
        return row.id, row.name
    if position is not None:
        name = position.strip()
        if not name:
            return None, None
        existing = db.scalar(
            select(Position).where(Position.organization_id == user.organization_id, Position.name == name)
        )
        if existing:
            return existing.id, existing.name
        if not create_missing:
            raise HTTPException(422, "Nieprawidłowe stanowisko")
        row = Position(organization_id=user.organization_id, name=name)
        db.add(row)
        db.flush()
        return row.id, row.name
    return None, None


def apply_position_fields(db: Session, user: User, values: dict, *, create_missing: bool) -> dict:
    if "position_id" not in values and "position" not in values:
        return values
    position_id = values.pop("position_id", None)
    position = values.pop("position", None)
    if position_id is None and position is None:
        values["position_id"] = None
        values["position"] = None
        return values
    resolved_id, resolved_name = resolve_position(
        db, user, position_id=position_id, position=position, create_missing=create_missing
    )
    values["position_id"] = resolved_id
    values["position"] = resolved_name
    return values


def tag_view(row: Tag) -> dict:
    return {
        "id": str(row.id),
        "name": row.name,
        "color": row.color,
        "is_informational": bool(row.is_informational),
    }


def can_see_informational_tags(db: Session, user: User) -> bool:
    return bool(role_codes(db, user).intersection({"manager", "hr", "admin"}))


def normalize_tag_color(color: str | None) -> str:
    value = (color or DEFAULT_TAG_COLOR).strip().upper()
    if len(value) == 7 and value.startswith("#"):
        # accept both upper/lower from clients; store canonical from whitelist
        lookup = {c.upper(): c for c in TAG_COLORS}
        if value in lookup:
            return lookup[value]
    raise HTTPException(422, "Nieprawidłowy kolor tagu")


def public_origin() -> str:
    return os.getenv("PUBLIC_ORIGIN", "http://localhost:8080").rstrip("/")


def invite_set_password_url(token: str) -> str:
    return f"{public_origin()}/set-password?token={token}"


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


def employee_account_status(db: Session, row: Employee) -> str:
    if not row.active:
        return "inactive"
    if row.user_id:
        linked = db.get(User, row.user_id)
        if linked and linked.password_hash is None:
            return "invited"
    return "active"


def deactivate_user_account(db: Session, user_id: UUID):
    target = db.get(User, user_id)
    if not target:
        return
    target.is_active = False
    db.execute(
        update(LoginSession)
        .where(LoginSession.user_id == target.id, LoginSession.revoked_at.is_(None))
        .values(revoked_at=now())
    )


def delete_user_account(db: Session, user_id: UUID):
    db.execute(delete(AuthToken).where(AuthToken.user_id == user_id))
    db.execute(delete(UserRole).where(UserRole.user_id == user_id))
    db.execute(delete(LoginSession).where(LoginSession.user_id == user_id))
    user = db.get(User, user_id)
    if user:
        db.delete(user)


def employee_view(db: Session, row: Employee, viewer: User | None = None):
    tags = list(
        db.scalars(
            select(Tag)
            .join(EmployeeTag, EmployeeTag.tag_id == Tag.id)
            .where(EmployeeTag.employee_id == row.id)
            .order_by(Tag.name)
        ).all()
    )
    if viewer is not None and not can_see_informational_tags(db, viewer):
        tags = [tag for tag in tags if not tag.is_informational]
    email = None
    roles: list[str] = []
    if row.user_id:
        linked = db.get(User, row.user_id)
        if linked:
            email = linked.email
            roles = sorted(role_codes(db, linked))
    supervisor_name = None
    if row.supervisor_id:
        supervisor = db.get(Employee, row.supervisor_id)
        if supervisor:
            supervisor_name = f"{supervisor.first_name} {supervisor.last_name}"
    return {
        "id": str(row.id),
        "employee_number": row.employee_number,
        "first_name": row.first_name,
        "last_name": row.last_name,
        "position_id": str(row.position_id) if row.position_id else None,
        "position": row.position,
        "phone": row.phone,
        "active": row.active,
        "status": employee_account_status(db, row),
        "user_id": str(row.user_id) if row.user_id else None,
        "email": email,
        "roles": roles,
        "supervisor_id": str(row.supervisor_id) if row.supervisor_id else None,
        "supervisor_name": supervisor_name,
        "tags": [tag_view(tag) for tag in tags],
        "tag_ids": [str(tag.id) for tag in tags],
        "hired_on": row.hired_on.isoformat() if row.hired_on else None,
        "ended_on": row.ended_on.isoformat() if row.ended_on else None,
    }


def check_links(db: Session, user: User, user_id: UUID | None):
    if user_id and not db.scalar(
        select(User.id).where(User.id == user_id, User.organization_id == user.organization_id)
    ):
        raise HTTPException(422, "Nieprawidłowe konto")


def check_unlinked_user(db: Session, user: User, user_id: UUID | None, employee_id: UUID | None = None):
    if user_id and db.scalar(
        select(Employee.id).where(
            Employee.organization_id == user.organization_id, Employee.user_id == user_id, Employee.id != employee_id
        )
    ):
        raise HTTPException(409, "Konto jest już powiązane z inną kartą")


def validate_supervisor(
    db: Session, user: User, supervisor_id: UUID | None, employee_id: UUID | None = None
):
    if supervisor_id is None:
        return
    if employee_id and supervisor_id == employee_id:
        raise HTTPException(422, "Pracownik nie może być własnym przełożonym")
    supervisor = db.scalar(
        select(Employee).where(Employee.id == supervisor_id, Employee.organization_id == user.organization_id)
    )
    if not supervisor:
        raise HTTPException(422, "Nieprawidłowy przełożony")
    if employee_id and supervisor.supervisor_id == employee_id:
        raise HTTPException(422, "Cykliczna relacja przełożonego")


def set_employee_tags(db: Session, user: User, employee_id: UUID, tag_ids: list[UUID]):
    unique_ids = list(dict.fromkeys(tag_ids))
    if unique_ids:
        found = db.scalars(
            select(Tag.id).where(Tag.organization_id == user.organization_id, Tag.id.in_(unique_ids))
        ).all()
        if len(found) != len(unique_ids):
            raise HTTPException(422, "Nieprawidłowy tag")
    db.execute(delete(EmployeeTag).where(EmployeeTag.employee_id == employee_id))
    db.add_all(EmployeeTag(employee_id=employee_id, tag_id=tag_id) for tag_id in unique_ids)


def assign_user_role(db: Session, actor: User, target_user_id: UUID, role_code: str):
    if "admin" not in role_codes(db, actor):
        raise HTTPException(403, "Tylko administrator może zmieniać role")
    target = db.scalar(
        select(User).where(User.id == target_user_id, User.organization_id == actor.organization_id).with_for_update()
    )
    if not target:
        raise HTTPException(422, "Nieprawidłowe konto")
    if target.id == actor.id and role_code != "admin":
        raise HTTPException(409, "Nie można usunąć własnego dostępu administratora")
    role = db.scalar(select(Role).where(Role.organization_id == actor.organization_id, Role.code == role_code))
    if not role:
        raise HTTPException(422, "Nieprawidłowa rola")
    db.execute(delete(UserRole).where(UserRole.user_id == target.id))
    db.add(UserRole(user_id=target.id, role_id=role.id))


def validate_employee_values(values: dict, row: Employee | None = None):
    if "employee_number" in values and values["employee_number"] is not None:
        values["employee_number"] = values["employee_number"].strip()
    for key in ("first_name", "last_name"):
        if key in values:
            if not values[key] or not str(values[key]).strip():
                raise HTTPException(422, "Imię i nazwisko nie mogą być puste")
            values[key] = str(values[key]).strip()
    if "phone" in values and values["phone"] is not None:
        phone = str(values["phone"]).strip()
        values["phone"] = phone or None
    hired_on = values.get("hired_on", row.hired_on if row else None)
    ended_on = values.get("ended_on", row.ended_on if row else None)
    if hired_on and ended_on and ended_on < hired_on:
        raise HTTPException(422, "Koniec zatrudnienia nie może poprzedzać początku")
    return values


def ensure_role(db: Session, actor: User, target_user_id: UUID, role_code: str):
    """Przypisz rolę — admin dowolną; HR/manager tylko employee przy tworzeniu konta."""
    codes = role_codes(db, actor)
    if "admin" in codes:
        assign_user_role(db, actor, target_user_id, role_code)
        return
    if role_code != "employee":
        raise HTTPException(403, "Tylko administrator może nadawać role inne niż pracownik")
    role = db.scalar(select(Role).where(Role.organization_id == actor.organization_id, Role.code == "employee"))
    if not role:
        raise HTTPException(422, "Nieprawidłowa rola")
    db.execute(delete(UserRole).where(UserRole.user_id == target_user_id))
    db.add(UserRole(user_id=target_user_id, role_id=role.id))


def resolve_account_for_employee(
    db: Session,
    actor: User,
    *,
    email: str | None,
    user_id: UUID | None,
    role: str | None,
) -> UUID | None:
    if user_id and email:
        raise HTTPException(422, "Podaj e-mail albo istniejące konto — nie oba")
    if user_id:
        check_links(db, actor, user_id)
        check_unlinked_user(db, actor, user_id)
        return user_id
    if not email:
        return None
    address = email.strip().lower()
    existing = db.scalar(
        select(User).where(User.organization_id == actor.organization_id, User.email == address)
    )
    if existing:
        check_unlinked_user(db, actor, existing.id)
        if role:
            ensure_role(db, actor, existing.id, role)
        return existing.id
    role_code = role or "employee"
    role_row = db.scalar(
        select(Role).where(Role.organization_id == actor.organization_id, Role.code == role_code)
    )
    if not role_row:
        raise HTTPException(422, "Nieprawidłowa rola")
    if "admin" not in role_codes(db, actor) and role_code != "employee":
        raise HTTPException(403, "Tylko administrator może zapraszać na role inne niż pracownik")
    invited = User(organization_id=actor.organization_id, email=address)
    db.add(invited)
    db.flush()
    db.add(UserRole(user_id=invited.id, role_id=role_row.id))
    token = issue_invite_token(db, invited.id)
    audit(db, actor, "auth.invite", "user", invited.id, {"role": role_code, "via": "employee.create"})
    from .auth import send_mail

    send_mail(address, "Zaproszenie do TimeLogic", invite_set_password_url(token))
    return invited.id


@app.get("/api/v1/tags")
def list_tags(user: User = Depends(current_user), db: Session = Depends(get_db)):
    statement = select(Tag).where(Tag.organization_id == user.organization_id)
    if not can_see_informational_tags(db, user):
        statement = statement.where(Tag.is_informational.is_(False))
    rows = db.scalars(statement.order_by(Tag.name)).all()
    return [tag_view(row) for row in rows]


@app.post("/api/v1/tags", status_code=201)
def create_tag(data: TagIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    name = data.name.strip()
    if db.scalar(select(Tag.id).where(Tag.organization_id == user.organization_id, Tag.name == name)):
        raise HTTPException(409, "Tag już istnieje")
    color = normalize_tag_color(data.color)
    row = Tag(
        organization_id=user.organization_id,
        name=name,
        color=color,
        is_informational=bool(data.is_informational),
    )
    db.add(row)
    db.flush()
    audit(db, user, "tag.create", "tag", row.id)
    db.commit()
    return tag_view(row)


@app.patch("/api/v1/tags/{tag_id}")
def patch_tag(
    tag_id: UUID, data: TagPatch, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    require_role(db, user, "admin", "hr")
    row = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.organization_id == user.organization_id))
    if not row:
        raise HTTPException(404, "Nie znaleziono tagu")
    payload = data.model_dump(exclude_unset=True)
    if "name" in payload:
        name = payload["name"].strip()
        if not name:
            raise HTTPException(422, "Nazwa tagu jest wymagana")
        existing = db.scalar(
            select(Tag.id).where(
                Tag.organization_id == user.organization_id,
                Tag.name == name,
                Tag.id != row.id,
            )
        )
        if existing:
            raise HTTPException(409, "Tag już istnieje")
        row.name = name
    if "color" in payload:
        row.color = normalize_tag_color(payload["color"])
    if "is_informational" in payload:
        row.is_informational = bool(payload["is_informational"])
    audit(db, user, "tag.update", "tag", row.id)
    db.commit()
    db.refresh(row)
    return tag_view(row)


@app.delete("/api/v1/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    row = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.organization_id == user.organization_id))
    if not row:
        raise HTTPException(404, "Nie znaleziono tagu")
    db.execute(delete(EmployeeTag).where(EmployeeTag.tag_id == row.id))
    db.delete(row)
    audit(db, user, "tag.delete", "tag", tag_id)
    db.commit()
    return Response(status_code=204)


@app.get("/api/v1/positions")
def list_positions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Position).where(Position.organization_id == user.organization_id).order_by(Position.name)
    ).all()
    return [{"id": str(row.id), "name": row.name} for row in rows]


@app.post("/api/v1/positions", status_code=201)
def create_position(data: PositionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    name = data.name.strip()
    if db.scalar(select(Position.id).where(Position.organization_id == user.organization_id, Position.name == name)):
        raise HTTPException(409, "Stanowisko już istnieje")
    row = Position(organization_id=user.organization_id, name=name)
    db.add(row)
    db.flush()
    audit(db, user, "position.create", "position", row.id)
    db.commit()
    return {"id": str(row.id), "name": row.name}


@app.delete("/api/v1/positions/{position_id}", status_code=204)
def delete_position(position_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    row = db.scalar(
        select(Position).where(Position.id == position_id, Position.organization_id == user.organization_id)
    )
    if not row:
        raise HTTPException(404, "Nie znaleziono stanowiska")
    employees = db.scalars(select(Employee).where(Employee.position_id == row.id)).all()
    for employee in employees:
        employee.position_id = None
        employee.position = None
    db.delete(row)
    audit(db, user, "position.delete", "position", position_id)
    db.commit()
    return Response(status_code=204)


@app.get("/api/v1/employees")
def employees(
    q: str = "",
    status: str = "all",
    role: str = "",
    tag_id: UUID | None = None,
    position: str = "",
    position_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 100))
    roles = role_codes(db, user)
    statement = select(Employee).where(Employee.organization_id == user.organization_id)
    if not roles.intersection({"admin", "hr"}):
        mine = own_employee(db, user)
        if "manager" in roles and mine:
            statement = statement.where((Employee.user_id == user.id) | (Employee.supervisor_id == mine.id))
        else:
            statement = statement.where(Employee.user_id == user.id)
    invited_users = select(User.id).where(
        User.organization_id == user.organization_id, User.password_hash.is_(None)
    )
    if status == "invited":
        statement = statement.where(Employee.active.is_(True), Employee.user_id.in_(invited_users))
    elif status == "active":
        # Aktywni karty — w tym zaproszeni (bez hasła); badge statusu w UI
        statement = statement.where(Employee.active.is_(True))
    elif status == "inactive":
        statement = statement.where(Employee.active.is_(False))
    elif status not in ("", "all"):
        raise HTTPException(422, "Nieprawidłowy status")
    if q:
        statement = statement.where(
            (Employee.first_name.ilike(f"%{q}%"))
            | (Employee.last_name.ilike(f"%{q}%"))
            | (Employee.employee_number.ilike(f"%{q}%"))
        )
    if position_id:
        statement = statement.where(Employee.position_id == position_id)
    elif position:
        statement = statement.where(Employee.position == position)
    if tag_id:
        statement = statement.where(
            Employee.id.in_(select(EmployeeTag.employee_id).where(EmployeeTag.tag_id == tag_id))
        )
    if role:
        statement = statement.where(
            Employee.user_id.in_(
                select(UserRole.user_id)
                .join(Role, Role.id == UserRole.role_id)
                .where(Role.organization_id == user.organization_id, Role.code == role)
            )
        )
    rows = db.scalars(
        statement.order_by(Employee.last_name, Employee.first_name, Employee.id).limit(limit).offset(max(0, offset))
    ).all()
    return [employee_view(db, x, user) for x in rows]


@app.get("/api/v1/employees/next-number")
def employees_next_number(user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    return {"employee_number": next_employee_number(db, user.organization_id)}


@app.post("/api/v1/employees", status_code=201)
def create_employee(data: EmployeeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    payload = data.model_dump()
    tag_ids = payload.pop("tag_ids", None) or []
    role = payload.pop("role", None) or "employee"
    email = payload.pop("email", None)
    linked_user_id = resolve_account_for_employee(
        db, user, email=str(email) if email else None, user_id=payload.pop("user_id", None), role=role
    )
    values = validate_employee_values(payload)
    values = apply_position_fields(db, user, values, create_missing=True)
    number = (values.get("employee_number") or "").strip()
    values["employee_number"] = number or next_employee_number(db, user.organization_id)
    values["user_id"] = linked_user_id
    validate_supervisor(db, user, data.supervisor_id)
    if db.scalar(
        select(Employee.id).where(
            Employee.organization_id == user.organization_id,
            Employee.employee_number == values["employee_number"],
        )
    ):
        raise HTTPException(409, "Numer pracownika już istnieje")
    if not linked_user_id:
        raise HTTPException(422, "E-mail jest wymagany do założenia konta")
    row = Employee(organization_id=user.organization_id, **values)
    db.add(row)
    db.flush()
    set_employee_tags(db, user, row.id, tag_ids)
    audit(db, user, "employee.create", "employee", row.id)
    db.commit()
    db.refresh(row)
    return employee_view(db, row, user)


@app.get("/api/v1/employees/{employee_id}")
def employee_detail(employee_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    from .security import employee_or_404

    return employee_view(db, employee_or_404(db, user, employee_id), user)


@app.post("/api/v1/employees/{employee_id}/resend-invite")
def resend_employee_invite(
    employee_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    from .security import employee_or_404
    from .auth import send_mail

    require_role(db, user, "admin", "hr")
    row = employee_or_404(db, user, employee_id, manage=True)
    if not row.user_id:
        raise HTTPException(422, "Pracownik nie ma powiązanego konta")
    linked = db.get(User, row.user_id)
    if not linked or linked.organization_id != user.organization_id:
        raise HTTPException(404, "Nie znaleziono konta")
    if linked.password_hash is not None:
        raise HTTPException(422, "Konto ma już ustawione hasło")
    token = issue_invite_token(db, linked.id)
    url = invite_set_password_url(token)
    audit(db, user, "auth.invite.resend", "user", linked.id, {"employee_id": str(row.id)})
    db.commit()
    sent = send_mail(linked.email, "Zaproszenie do TimeLogic", url)
    return {"ok": True, "email_sent": sent, "invite_url": None if sent else url}


@app.delete("/api/v1/employees/{employee_id}", status_code=204)
def delete_employee(
    employee_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    from .security import employee_or_404

    require_role(db, user, "admin", "hr")
    row = employee_or_404(db, user, employee_id, manage=True)
    if row.user_id and row.user_id == user.id:
        raise HTTPException(409, "Nie możesz usunąć własnego konta")
    linked_id = row.user_id
    db.execute(delete(EmployeeTag).where(EmployeeTag.employee_id == row.id))
    # odłącz podwładnych
    db.execute(
        update(Employee)
        .where(Employee.supervisor_id == row.id)
        .values(supervisor_id=None)
    )
    audit(db, user, "employee.delete", "employee", row.id)
    db.delete(row)
    db.flush()
    if linked_id:
        delete_user_account(db, linked_id)
    db.commit()
    return Response(status_code=204)


@app.patch("/api/v1/employees/{employee_id}")
def patch_employee(
    employee_id: UUID, data: EmployeePatch, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    from .security import employee_or_404

    row = employee_or_404(db, user, employee_id, manage=True)
    payload = data.model_dump(exclude_unset=True)
    tag_ids = payload.pop("tag_ids", None)
    role = payload.pop("role", None)
    validate_employee_values(payload, row)
    payload = apply_position_fields(db, user, payload, create_missing=True)
    check_links(db, user, payload.get("user_id"))
    check_unlinked_user(db, user, payload.get("user_id"), row.id)
    if "supervisor_id" in payload:
        validate_supervisor(db, user, payload["supervisor_id"], row.id)
    before = employee_view(db, row, user)
    for key, value in payload.items():
        setattr(row, key, value)
    if tag_ids is not None:
        set_employee_tags(db, user, row.id, tag_ids)
    linked_user_id = payload.get("user_id", row.user_id)
    if role is not None:
        if not linked_user_id:
            raise HTTPException(422, "Rola wymaga powiązanego konta")
        assign_user_role(db, user, linked_user_id, role)
    if payload.get("active") is False and row.user_id:
        if row.user_id == user.id:
            raise HTTPException(409, "Nie możesz dezaktywować własnego konta")
        deactivate_user_account(db, row.user_id)
    audit(
        db,
        user,
        "employee.update",
        "employee",
        row.id,
        {"before": before, "after": employee_view(db, row, user)},
    )
    db.commit()
    db.refresh(row)
    return employee_view(db, row, user)


@app.get("/api/v1/audit-logs")
def audit_logs(limit: int = 50, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    rows = db.scalars(
        select(AuditLog)
        .where(AuditLog.organization_id == user.organization_id)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(max(1, min(limit, 100)))
    ).all()
    return [
        {
            "id": str(row.id),
            "action": row.action,
            "target_type": row.target_type,
            "target_id": str(row.target_id) if row.target_id else None,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


from . import auth, leave, rcp, shifts  # noqa: E402

app.include_router(auth.router, prefix="/api/v1")
app.include_router(rcp.router, prefix="/api/v1")
app.include_router(shifts.router, prefix="/api/v1")
app.include_router(leave.router, prefix="/api/v1")
