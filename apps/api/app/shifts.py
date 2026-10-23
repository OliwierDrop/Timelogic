from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Employee, ShiftAssignment, ShiftTemplate, User
from .security import (
    can_manage_employee,
    can_read_employee,
    current_user,
    employee_or_404,
    now,
    require_role,
    role_codes,
)


router = APIRouter(tags=["Grafiki"])


def audit(db: Session, user: User, action: str, kind: str, target: UUID, detail=None):
    from .main import audit as write_audit

    write_audit(db, user, action, kind, target, detail)


def can_plan(db: Session, user: User) -> bool:
    return bool(role_codes(db, user).intersection({"admin", "hr", "manager"}))


def shift_view(row: ShiftAssignment):
    return {
        "id": str(row.id),
        "employee_id": str(row.employee_id),
        "template_id": str(row.template_id) if row.template_id else None,
        "started_at": row.started_at.isoformat(),
        "ended_at": row.ended_at.isoformat(),
        "published_at": row.published_at.isoformat() if row.published_at else None,
        "published": row.published_at is not None,
    }


def template_view(row: ShiftTemplate):
    return {
        "id": str(row.id),
        "name": row.name,
        "start_minute": row.start_minute,
        "duration_minutes": row.duration_minutes,
    }


def assert_range(started_at: datetime, ended_at: datetime):
    if started_at.tzinfo is None or ended_at.tzinfo is None:
        raise HTTPException(422, "Wymagany czas z strefą")
    if ended_at <= started_at:
        raise HTTPException(422, "Koniec musi być po początku")


def overlaps(db: Session, employee_id: UUID, started_at: datetime, ended_at: datetime, exclude_id: UUID | None = None):
    statement = select(ShiftAssignment.id).where(
        ShiftAssignment.employee_id == employee_id,
        ShiftAssignment.started_at < ended_at,
        ShiftAssignment.ended_at > started_at,
    )
    if exclude_id:
        statement = statement.where(ShiftAssignment.id != exclude_id)
    return db.scalar(statement) is not None


def locked_shift(db: Session, user: User, shift_id: UUID, manage=True):
    row = db.scalar(
        select(ShiftAssignment)
        .where(ShiftAssignment.id == shift_id, ShiftAssignment.organization_id == user.organization_id)
        .with_for_update()
    )
    if not row:
        raise HTTPException(404, "Nie znaleziono przydziału")
    employee_or_404(db, user, row.employee_id, manage=manage)
    return row


@router.get("/shift-templates")
def list_templates(user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    rows = db.scalars(
        select(ShiftTemplate)
        .where(ShiftTemplate.organization_id == user.organization_id)
        .order_by(ShiftTemplate.name, ShiftTemplate.id)
    ).all()
    return [template_view(x) for x in rows]


class TemplateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    start_minute: int = Field(ge=0, lt=24 * 60)
    duration_minutes: int = Field(gt=0, le=24 * 60)


@router.post("/shift-templates", status_code=201)
def create_template(data: TemplateIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    row = ShiftTemplate(
        organization_id=user.organization_id,
        name=data.name.strip(),
        start_minute=data.start_minute,
        duration_minutes=data.duration_minutes,
    )
    db.add(row)
    db.flush()
    audit(db, user, "shift.template.create", "shift_template", row.id)
    db.commit()
    return template_view(row)


@router.get("/shifts")
def list_shifts(
    from_at: datetime | None = Query(None, alias="from"),
    to_at: datetime | None = Query(None, alias="to"),
    employee_id: UUID | None = None,
    include_drafts: bool = False,
    limit: int = 200,
    offset: int = 0,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if from_at and to_at and to_at <= from_at:
        raise HTTPException(422, "Nieprawidłowy zakres dat")
    planner = can_plan(db, user)
    statement = select(ShiftAssignment).where(ShiftAssignment.organization_id == user.organization_id)
    if from_at:
        statement = statement.where(ShiftAssignment.ended_at > from_at)
    if to_at:
        statement = statement.where(ShiftAssignment.started_at < to_at)
    if employee_id:
        employee_or_404(db, user, employee_id, manage=False)
        statement = statement.where(ShiftAssignment.employee_id == employee_id)
    if not planner or not include_drafts:
        statement = statement.where(ShiftAssignment.published_at.is_not(None))
    rows = db.scalars(
        statement.order_by(ShiftAssignment.started_at, ShiftAssignment.id)
        .limit(max(1, min(limit, 500)))
        .offset(max(0, offset))
    ).all()
    visible = []
    for row in rows:
        employee = db.get(Employee, row.employee_id)
        if not employee:
            continue
        if row.published_at is None:
            if can_manage_employee(db, user, employee):
                visible.append(row)
        elif can_read_employee(db, user, employee):
            visible.append(row)
    return [shift_view(x) for x in visible]


class ShiftIn(BaseModel):
    employee_id: UUID
    started_at: datetime
    ended_at: datetime
    template_id: UUID | None = None


@router.post("/shifts", status_code=201)
def create_shift(data: ShiftIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    employee = employee_or_404(db, user, data.employee_id, manage=True)
    assert_range(data.started_at, data.ended_at)
    if data.template_id:
        template = db.scalar(
            select(ShiftTemplate).where(
                ShiftTemplate.id == data.template_id, ShiftTemplate.organization_id == user.organization_id
            )
        )
        if not template:
            raise HTTPException(422, "Nieprawidłowy szablon")
    db.execute(select(Employee.id).where(Employee.id == employee.id).with_for_update()).one()
    if overlaps(db, employee.id, data.started_at, data.ended_at):
        raise HTTPException(409, "Przydział nakłada się na inny grafik")
    row = ShiftAssignment(
        organization_id=user.organization_id,
        employee_id=employee.id,
        template_id=data.template_id,
        started_at=data.started_at,
        ended_at=data.ended_at,
    )
    db.add(row)
    db.flush()
    audit(db, user, "shift.create", "shift_assignment", row.id)
    db.commit()
    return shift_view(row)


class ShiftPatch(BaseModel):
    started_at: datetime | None = None
    ended_at: datetime | None = None
    template_id: UUID | None = None
    clear_template: bool = False


@router.patch("/shifts/{shift_id}")
def patch_shift(shift_id: UUID, data: ShiftPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    row = locked_shift(db, user, shift_id)
    if row.published_at:
        raise HTTPException(409, "Opublikowany przydział nie może być edytowany")
    started_at = data.started_at or row.started_at
    ended_at = data.ended_at or row.ended_at
    assert_range(started_at, ended_at)
    if data.clear_template:
        row.template_id = None
    elif data.template_id is not None:
        template = db.scalar(
            select(ShiftTemplate).where(
                ShiftTemplate.id == data.template_id, ShiftTemplate.organization_id == user.organization_id
            )
        )
        if not template:
            raise HTTPException(422, "Nieprawidłowy szablon")
        row.template_id = data.template_id
    if overlaps(db, row.employee_id, started_at, ended_at, exclude_id=row.id):
        raise HTTPException(409, "Przydział nakłada się na inny grafik")
    row.started_at, row.ended_at = started_at, ended_at
    audit(db, user, "shift.update", "shift_assignment", row.id)
    db.commit()
    return shift_view(row)


class PublishIn(BaseModel):
    shift_ids: list[UUID] = Field(min_length=1, max_length=200)


@router.post("/shifts/publish")
def publish_shifts(data: PublishIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    published = []
    for shift_id in data.shift_ids:
        row = locked_shift(db, user, shift_id)
        if row.published_at:
            published.append(shift_view(row))
            continue
        if overlaps(db, row.employee_id, row.started_at, row.ended_at, exclude_id=row.id):
            raise HTTPException(409, "Publikacja koliduje z innym przydziałem")
        row.published_at = now()
        audit(db, user, "shift.publish", "shift_assignment", row.id)
        published.append(shift_view(row))
    db.commit()
    return published
