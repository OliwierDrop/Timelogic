"""Pracownicy: karty, zaproszenia, warunki zatrudnienia."""

import re
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from .catalog import apply_position_fields, can_see_informational_tags, tag_view
from .db import get_db
from .employment import CONTRACT_TYPES, employment_term_as_of, term_view
from .models import (
    AuthToken,
    Employee,
    EmployeeEmploymentTerm,
    EmployeeTag,
    Role,
    Session as LoginSession,
    Tag,
    User,
    UserRole,
)
from .security import current_user, now, own_employee, require_role, role_codes


router = APIRouter(tags=["Pracownicy"])


def audit(db: Session, user: User, action: str, kind: str, target: UUID | None, detail=None):
    from .main import audit as write_audit

    write_audit(db, user, action, kind, target, detail)


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
    email: EmailStr | None = None
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


def request_email_change(db: Session, actor: User, employee: Employee, email: str) -> dict | None:
    """Ustawia pending_email i wysyła link potwierdzający na nowy adres."""
    if not employee.user_id:
        raise HTTPException(422, "Brak powiązanego konta do zmiany e-maila")
    linked = db.get(User, employee.user_id)
    if not linked:
        raise HTTPException(422, "Brak powiązanego konta do zmiany e-maila")
    address = email.strip().lower()
    current = linked.email.lower()
    if address == current:
        if linked.pending_email:
            linked.pending_email = None
            db.execute(
                update(AuthToken)
                .where(
                    AuthToken.user_id == linked.id,
                    AuthToken.purpose == "email_change",
                    AuthToken.used_at.is_(None),
                )
                .values(used_at=now())
            )
        return None
    clash = db.scalar(
        select(User.id).where(
            User.organization_id == actor.organization_id,
            User.email == address,
            User.id != linked.id,
        )
    )
    if clash:
        raise HTTPException(409, "Konto z tym e-mailem już istnieje")
    linked.pending_email = address
    from .auth import email_change_mail_body, email_confirm_url, issue_email_change_token, send_mail

    token = issue_email_change_token(db, linked.id)
    url = email_confirm_url(token)

    sent = send_mail(
        address,
        "Potwierdź zmianę e-maila — TimeLogic",
        url,
        body=email_change_mail_body(url),
    )
    audit(
        db,
        actor,
        "auth.email_change_request",
        "user",
        linked.id,
        {"pending_email": address, "email_sent": sent},
    )
    return {
        "pending_email": address,
        "email_sent": sent,
        "confirm_url": None if sent else url,
    }


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
    pending_email = None
    roles: list[str] = []
    if row.user_id:
        linked = db.get(User, row.user_id)
        if linked:
            email = linked.email
            pending_email = linked.pending_email
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
        "pending_email": pending_email,
        "roles": roles,
        "supervisor_id": str(row.supervisor_id) if row.supervisor_id else None,
        "supervisor_name": supervisor_name,
        "tags": [tag_view(tag) for tag in tags],
        "tag_ids": [str(tag.id) for tag in tags],
        "hired_on": row.hired_on.isoformat() if row.hired_on else None,
        "ended_on": row.ended_on.isoformat() if row.ended_on else None,
        "current_contract_type": (
            current.contract_type if (current := employment_term_as_of(db, row.id, now().date())) else None
        ),
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
) -> UUID:
    """Zawsze zwraca id konta z e-mailem — członek zespołu nie może istnieć bez User."""
    if user_id and email:
        raise HTTPException(422, "Podaj e-mail albo istniejące konto — nie oba")
    if user_id:
        check_links(db, actor, user_id)
        check_unlinked_user(db, actor, user_id)
        return user_id
    if not email:
        raise HTTPException(422, "E-mail jest wymagany do założenia konta")
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
    from .auth import invite_set_password_url, issue_invite_token, send_mail

    token = issue_invite_token(db, invited.id)
    audit(db, actor, "auth.invite", "user", invited.id, {"role": role_code, "via": "employee.create"})
    send_mail(address, "Zaproszenie do TimeLogic", invite_set_password_url(token))
    return invited.id


@router.get("/employees")
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


@router.get("/employees/next-number")
def employees_next_number(user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    return {"employee_number": next_employee_number(db, user.organization_id)}


@router.post("/employees", status_code=201)
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
    row = Employee(organization_id=user.organization_id, **values)
    db.add(row)
    db.flush()
    set_employee_tags(db, user, row.id, tag_ids)
    audit(db, user, "employee.create", "employee", row.id)
    db.commit()
    db.refresh(row)
    return employee_view(db, row, user)


@router.get("/employees/{employee_id}")
def employee_detail(employee_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    from .security import employee_or_404

    return employee_view(db, employee_or_404(db, user, employee_id), user)


@router.post("/employees/{employee_id}/resend-invite")
def resend_employee_invite(
    employee_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    from .security import employee_or_404
    from .auth import invite_set_password_url, issue_invite_token, send_mail

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


@router.delete("/employees/{employee_id}", status_code=204)
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


@router.patch("/employees/{employee_id}")
def patch_employee(
    employee_id: UUID, data: EmployeePatch, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    from .security import employee_or_404

    row = employee_or_404(db, user, employee_id, manage=True)
    payload = data.model_dump(exclude_unset=True)
    tag_ids = payload.pop("tag_ids", None)
    role = payload.pop("role", None)
    email_value = payload.pop("email", None)
    email_was_set = "email" in data.model_fields_set
    validate_employee_values(payload, row)
    payload = apply_position_fields(db, user, payload, create_missing=True)
    if "user_id" in payload:
        if payload["user_id"] is None:
            raise HTTPException(422, "Nie można odłączyć konta od karty pracownika")
        check_links(db, user, payload["user_id"])
        check_unlinked_user(db, user, payload["user_id"], row.id)
    if "supervisor_id" in payload:
        validate_supervisor(db, user, payload["supervisor_id"], row.id)
    before = employee_view(db, row, user)
    for key, value in payload.items():
        setattr(row, key, value)
    if tag_ids is not None:
        set_employee_tags(db, user, row.id, tag_ids)
    linked_user_id = payload.get("user_id", row.user_id)
    if not linked_user_id:
        raise HTTPException(422, "Karta pracownika wymaga powiązanego konta z e-mailem")
    if role is not None:
        assign_user_role(db, user, linked_user_id, role)
    if payload.get("active") is False and row.user_id:
        if row.user_id == user.id:
            raise HTTPException(409, "Nie możesz dezaktywować własnego konta")
        deactivate_user_account(db, row.user_id)
    email_change = None
    if email_was_set:
        if email_value is None:
            raise HTTPException(422, "Podaj adres e-mail")
        email_change = request_email_change(db, user, row, str(email_value))
    after = employee_view(db, row, user)
    audit(
        db,
        user,
        "employee.update",
        "employee",
        row.id,
        {"before": before, "after": after},
    )
    db.commit()
    db.refresh(row)
    after = employee_view(db, row, user)
    if email_change:
        after = {**after, "email_change": email_change}
    return after


class EmploymentTermIn(BaseModel):
    effective_from: date
    contract_type: str = Field(pattern=r"^(employment|mandate|specific_task)$")
    daily_minutes: int = Field(default=480, ge=0, le=24 * 60)


@router.get("/employees/{employee_id}/employment-terms")
def list_employment_terms(
    employee_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    from .security import employee_or_404

    employee_or_404(db, user, employee_id)
    rows = db.scalars(
        select(EmployeeEmploymentTerm)
        .where(EmployeeEmploymentTerm.employee_id == employee_id)
        .order_by(EmployeeEmploymentTerm.effective_from)
    ).all()
    return [term_view(row) for row in rows]


@router.put("/employees/{employee_id}/employment-terms")
def replace_employment_terms(
    employee_id: UUID,
    data: list[EmploymentTermIn],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    from .security import employee_or_404

    require_role(db, user, "admin", "hr")
    employee_or_404(db, user, employee_id, manage=True)
    dates = [item.effective_from for item in data]
    if len(dates) != len(set(dates)):
        raise HTTPException(422, "Powtórzona data początku warunków")
    for item in data:
        if item.contract_type not in CONTRACT_TYPES:
            raise HTTPException(422, "Nieprawidłowy typ umowy")
    db.execute(
        delete(EmployeeEmploymentTerm).where(EmployeeEmploymentTerm.employee_id == employee_id)
    )
    rows = [
        EmployeeEmploymentTerm(
            employee_id=employee_id,
            effective_from=item.effective_from,
            contract_type=item.contract_type,
            daily_minutes=item.daily_minutes,
        )
        for item in data
    ]
    db.add_all(rows)
    audit(
        db,
        user,
        "employee.employment_terms",
        "employee",
        employee_id,
        {"count": len(rows)},
    )
    db.commit()
    saved = db.scalars(
        select(EmployeeEmploymentTerm)
        .where(EmployeeEmploymentTerm.employee_id == employee_id)
        .order_by(EmployeeEmploymentTerm.effective_from)
    ).all()
    return [term_view(row) for row in saved]


