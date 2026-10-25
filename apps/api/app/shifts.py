from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import (
    AvailabilityEntry,
    CalendarDayType,
    Employee,
    ShiftAssignment,
    ShiftTemplate,
    User,
)
from .security import (
    can_manage_employee,
    can_read_employee,
    current_user,
    employee_or_404,
    now,
    own_employee,
    require_role,
    role_codes,
)


router = APIRouter(tags=["Grafiki"])

ShiftKind = Literal["standard", "flexible", "on_call"]
DayTypeCode = Literal["P", "ND", "SW", "TP5", "HW"]
AvailabilityStatus = Literal["available", "hours", "unavailable"]
DAY_TYPE_CODES = {"P", "ND", "SW", "TP5", "HW"}


def default_day_type_code(day: date) -> DayTypeCode:
    """Pn–Pt = P, sobota = 5TP, niedziela = ND."""
    weekday = day.weekday()  # 0=Mon … 6=Sun
    if weekday == 5:
        return "TP5"
    if weekday == 6:
        return "ND"
    return "P"


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
        "kind": row.kind,
        "color": row.color,
        "note": row.note,
        "flags": row.flags or {},
        "replaces_id": str(row.replaces_id) if row.replaces_id else None,
        "superseded_at": row.superseded_at.isoformat() if row.superseded_at else None,
        "is_draft": row.published_at is None,
    }


def template_view(row: ShiftTemplate):
    return {
        "id": str(row.id),
        "name": row.name,
        "start_minute": row.start_minute,
        "duration_minutes": row.duration_minutes,
    }


def day_type_view(row: CalendarDayType):
    return {
        "id": str(row.id),
        "employee_id": str(row.employee_id),
        "day": row.day.isoformat(),
        "code": row.code,
    }


def availability_view(row: AvailabilityEntry):
    return {
        "id": str(row.id),
        "employee_id": str(row.employee_id),
        "day": row.day.isoformat(),
        "status": row.status,
        "start_minute": row.start_minute,
        "end_minute": row.end_minute,
    }


def assert_range(started_at: datetime, ended_at: datetime):
    if started_at.tzinfo is None or ended_at.tzinfo is None:
        raise HTTPException(422, "Wymagany czas z strefą")
    if ended_at <= started_at:
        raise HTTPException(422, "Koniec musi być po początku")


def normalize_flags(flags: dict | None) -> dict:
    return dict(flags or {})


def validate_kind_times(kind: str, started_at: datetime, ended_at: datetime):
    assert_range(started_at, ended_at)
    if kind == "standard" and (ended_at - started_at).total_seconds() < 60:
        raise HTTPException(422, "Czas wymagany")


def active_layer_ids(db: Session, organization_id: UUID, employee_id: UUID) -> set[UUID]:
    """IDs visible in the planner active layer (drafts mask replaced published rows)."""
    rows = db.scalars(
        select(ShiftAssignment).where(
            ShiftAssignment.organization_id == organization_id,
            ShiftAssignment.employee_id == employee_id,
            ShiftAssignment.superseded_at.is_(None),
        )
    ).all()
    replaced = {row.replaces_id for row in rows if row.published_at is None and row.replaces_id}
    active = set()
    for row in rows:
        if row.id in replaced:
            continue
        active.add(row.id)
    return active


def overlaps(
    db: Session,
    organization_id: UUID,
    employee_id: UUID,
    started_at: datetime,
    ended_at: datetime,
    exclude_id: UUID | None = None,
    also_exclude: set[UUID] | None = None,
):
    active = active_layer_ids(db, organization_id, employee_id)
    if also_exclude:
        active -= also_exclude
    if exclude_id:
        active.discard(exclude_id)
    if not active:
        return False
    statement = select(ShiftAssignment.id).where(
        ShiftAssignment.id.in_(active),
        ShiftAssignment.started_at < ended_at,
        ShiftAssignment.ended_at > started_at,
    )
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


def resolve_template(db: Session, user: User, template_id: UUID | None):
    if not template_id:
        return None
    template = db.scalar(
        select(ShiftTemplate).where(
            ShiftTemplate.id == template_id, ShiftTemplate.organization_id == user.organization_id
        )
    )
    if not template:
        raise HTTPException(422, "Nieprawidłowy szablon")
    return template


def polish_fixed_holiday(day: date) -> bool:
    fixed = {
        (1, 1),
        (1, 6),
        (5, 1),
        (5, 3),
        (8, 15),
        (11, 1),
        (11, 11),
        (12, 25),
        (12, 26),
    }
    return (day.month, day.day) in fixed


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
    statement = select(ShiftAssignment).where(
        ShiftAssignment.organization_id == user.organization_id,
        ShiftAssignment.superseded_at.is_(None),
    )
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

    if planner and include_drafts:
        replaced = {row.replaces_id for row in rows if row.published_at is None and row.replaces_id}
        rows = [row for row in rows if row.id not in replaced]

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
    kind: ShiftKind = "standard"
    color: str | None = Field(default=None, max_length=20)
    note: str | None = Field(default=None, max_length=2000)
    flags: dict[str, Any] | None = None
    replaces_id: UUID | None = None


@router.post("/shifts", status_code=201)
def create_shift(data: ShiftIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    employee = employee_or_404(db, user, data.employee_id, manage=True)
    validate_kind_times(data.kind, data.started_at, data.ended_at)
    resolve_template(db, user, data.template_id)

    exclude_replaced: set[UUID] = set()
    if data.replaces_id:
        target = locked_shift(db, user, data.replaces_id)
        if target.employee_id != employee.id:
            raise HTTPException(422, "Zastępowany grafik należy do innego pracownika")
        if target.published_at is None:
            raise HTTPException(422, "Można zastąpić tylko opublikowany grafik")
        if target.superseded_at is not None:
            raise HTTPException(422, "Grafik już został supersedowany")
        existing_draft = db.scalar(
            select(ShiftAssignment.id).where(
                ShiftAssignment.replaces_id == target.id,
                ShiftAssignment.published_at.is_(None),
                ShiftAssignment.superseded_at.is_(None),
            )
        )
        if existing_draft:
            raise HTTPException(409, "Istnieje już szkic zastępujący ten grafik")
        exclude_replaced.add(target.id)

    db.execute(select(Employee.id).where(Employee.id == employee.id).with_for_update()).one()
    if overlaps(
        db,
        user.organization_id,
        employee.id,
        data.started_at,
        data.ended_at,
        also_exclude=exclude_replaced,
    ):
        raise HTTPException(409, "Przydział nakłada się na inny grafik")
    row = ShiftAssignment(
        organization_id=user.organization_id,
        employee_id=employee.id,
        template_id=data.template_id,
        started_at=data.started_at,
        ended_at=data.ended_at,
        kind=data.kind,
        color=data.color,
        note=data.note,
        flags=normalize_flags(data.flags),
        replaces_id=data.replaces_id,
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
    kind: ShiftKind | None = None
    color: str | None = Field(default=None, max_length=20)
    note: str | None = Field(default=None, max_length=2000)
    flags: dict[str, Any] | None = None


@router.patch("/shifts/{shift_id}")
def patch_shift(shift_id: UUID, data: ShiftPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    row = locked_shift(db, user, shift_id)
    if row.published_at is not None:
        raise HTTPException(409, "Opublikowany przydział edytuj przez nowy szkic (replaces_id)")
    if row.superseded_at is not None:
        raise HTTPException(409, "Nie można edytować supersedowanego przydziału")
    started_at = data.started_at or row.started_at
    ended_at = data.ended_at or row.ended_at
    kind = data.kind or row.kind
    validate_kind_times(kind, started_at, ended_at)
    if data.clear_template:
        row.template_id = None
    elif data.template_id is not None:
        resolve_template(db, user, data.template_id)
        row.template_id = data.template_id
    exclude = {row.replaces_id} if row.replaces_id else set()
    if overlaps(
        db,
        user.organization_id,
        row.employee_id,
        started_at,
        ended_at,
        exclude_id=row.id,
        also_exclude=exclude,
    ):
        raise HTTPException(409, "Przydział nakłada się na inny grafik")
    row.started_at, row.ended_at = started_at, ended_at
    row.kind = kind
    if data.color is not None:
        row.color = data.color
    if data.note is not None:
        row.note = data.note
    if data.flags is not None:
        row.flags = normalize_flags(data.flags)
    audit(db, user, "shift.update", "shift_assignment", row.id)
    db.commit()
    return shift_view(row)


@router.delete("/shifts/{shift_id}", status_code=204)
def delete_shift(shift_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    row = locked_shift(db, user, shift_id)
    if row.superseded_at is not None:
        raise HTTPException(409, "Nie można usunąć supersedowanego przydziału")
    if row.published_at is not None:
        draft = db.scalar(
            select(ShiftAssignment.id).where(
                ShiftAssignment.replaces_id == row.id,
                ShiftAssignment.published_at.is_(None),
            )
        )
        if draft:
            raise HTTPException(409, "Najpierw odrzuć szkic zastępujący")
    audit(db, user, "shift.delete", "shift_assignment", row.id)
    db.delete(row)
    db.commit()


class PublishIn(BaseModel):
    shift_ids: list[UUID] = Field(min_length=1, max_length=200)


@router.post("/shifts/publish")
def publish_shifts(data: PublishIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    published = []
    for shift_id in data.shift_ids:
        row = locked_shift(db, user, shift_id)
        if row.superseded_at is not None:
            raise HTTPException(409, "Nie można opublikować supersedowanego przydziału")
        if row.published_at:
            published.append(shift_view(row))
            continue
        exclude = {row.replaces_id} if row.replaces_id else set()
        if overlaps(
            db,
            user.organization_id,
            row.employee_id,
            row.started_at,
            row.ended_at,
            exclude_id=row.id,
            also_exclude=exclude,
        ):
            raise HTTPException(409, "Publikacja koliduje z innym przydziałem")
        if row.replaces_id:
            target = db.scalar(
                select(ShiftAssignment)
                .where(ShiftAssignment.id == row.replaces_id)
                .with_for_update()
            )
            if target and target.superseded_at is None:
                target.superseded_at = now()
                audit(db, user, "shift.supersede", "shift_assignment", target.id)
        row.published_at = now()
        audit(db, user, "shift.publish", "shift_assignment", row.id)
        published.append(shift_view(row))
    db.commit()
    return published


class RejectDraftsIn(BaseModel):
    shift_ids: list[UUID] | None = None
    from_at: datetime | None = None
    to_at: datetime | None = None
    employee_ids: list[UUID] | None = None


@router.post("/shifts/reject-drafts")
def reject_drafts(data: RejectDraftsIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    statement = select(ShiftAssignment).where(
        ShiftAssignment.organization_id == user.organization_id,
        ShiftAssignment.published_at.is_(None),
        ShiftAssignment.superseded_at.is_(None),
    )
    if data.shift_ids:
        statement = statement.where(ShiftAssignment.id.in_(data.shift_ids))
    if data.from_at:
        statement = statement.where(ShiftAssignment.ended_at > data.from_at)
    if data.to_at:
        statement = statement.where(ShiftAssignment.started_at < data.to_at)
    if data.employee_ids:
        statement = statement.where(ShiftAssignment.employee_id.in_(data.employee_ids))
    rows = db.scalars(statement.with_for_update()).all()
    removed = []
    for row in rows:
        employee_or_404(db, user, row.employee_id, manage=True)
        removed.append(str(row.id))
        audit(db, user, "shift.reject_draft", "shift_assignment", row.id)
        db.delete(row)
    db.commit()
    return {"removed": removed}


class BulkShiftIn(BaseModel):
    employee_ids: list[UUID] = Field(min_length=1, max_length=200)
    kind: ShiftKind = "standard"
    started_time: str = Field(description="HH:MM")
    ended_time: str = Field(description="HH:MM")
    weekdays: list[int] = Field(min_length=1, max_length=7, description="0=Mon .. 6=Sun")
    from_date: date
    to_date: date
    skip_holidays: bool = False
    overwrite: bool = False
    color: str | None = None
    note: str | None = None
    flags: dict[str, Any] | None = None
    template_id: UUID | None = None


def parse_hhmm(value: str) -> tuple[int, int]:
    try:
        hour, minute = value.split(":")
        h, m = int(hour), int(minute)
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError
        return h, m
    except ValueError as exc:
        raise HTTPException(422, "Nieprawidłowy format godziny") from exc


@router.post("/shifts/bulk", status_code=201)
def bulk_create(data: BulkShiftIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    if data.to_date < data.from_date:
        raise HTTPException(422, "Nieprawidłowy zakres dat")
    if (data.to_date - data.from_date).days > 366:
        raise HTTPException(422, "Zakres zbyt długi")
    for wd in data.weekdays:
        if wd < 0 or wd > 6:
            raise HTTPException(422, "Nieprawidłowy dzień tygodnia")
    start_h, start_m = parse_hhmm(data.started_time)
    end_h, end_m = parse_hhmm(data.ended_time)
    resolve_template(db, user, data.template_id)
    created = []
    day = data.from_date
    while day <= data.to_date:
        if day.weekday() in data.weekdays:
            if not (data.skip_holidays and (day.weekday() >= 5 or polish_fixed_holiday(day))):
                started = datetime.combine(day, time(start_h, start_m), tzinfo=timezone.utc)
                ended = datetime.combine(day, time(end_h, end_m), tzinfo=timezone.utc)
                if ended <= started:
                    ended += timedelta(days=1)
                validate_kind_times(data.kind, started, ended)
                for employee_id in data.employee_ids:
                    employee = employee_or_404(db, user, employee_id, manage=True)
                    db.execute(select(Employee.id).where(Employee.id == employee.id).with_for_update()).one()
                    active = active_layer_ids(db, user.organization_id, employee.id)
                    conflicting = []
                    if active:
                        conflicting = list(
                            db.scalars(
                                select(ShiftAssignment).where(
                                    ShiftAssignment.id.in_(active),
                                    ShiftAssignment.started_at < ended,
                                    ShiftAssignment.ended_at > started,
                                )
                            ).all()
                        )
                    exclude: set[UUID] = set()
                    replaces_id = None
                    if conflicting:
                        if not data.overwrite:
                            raise HTTPException(
                                409, f"Konflikt grafiku dla {employee.id} w dniu {day.isoformat()}"
                            )
                        for conflict in conflicting:
                            if conflict.published_at is None:
                                audit(db, user, "shift.reject_draft", "shift_assignment", conflict.id)
                                db.delete(conflict)
                            else:
                                replaces_id = conflict.id
                                exclude.add(conflict.id)
                    if overlaps(
                        db,
                        user.organization_id,
                        employee.id,
                        started,
                        ended,
                        also_exclude=exclude,
                    ):
                        raise HTTPException(
                            409, f"Konflikt grafiku dla {employee.id} w dniu {day.isoformat()}"
                        )
                    row = ShiftAssignment(
                        organization_id=user.organization_id,
                        employee_id=employee.id,
                        template_id=data.template_id,
                        started_at=started,
                        ended_at=ended,
                        kind=data.kind,
                        color=data.color,
                        note=data.note,
                        flags=normalize_flags(data.flags),
                        replaces_id=replaces_id,
                    )
                    db.add(row)
                    db.flush()
                    audit(db, user, "shift.create", "shift_assignment", row.id)
                    created.append(shift_view(row))
        day += timedelta(days=1)
    db.commit()
    return {"created": created, "count": len(created)}


class CopyShiftsIn(BaseModel):
    shift_ids: list[UUID] = Field(min_length=1, max_length=200)
    target_employee_id: UUID


@router.post("/shifts/copy", status_code=201)
def copy_shifts(data: CopyShiftsIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    target = employee_or_404(db, user, data.target_employee_id, manage=True)
    created = []
    for shift_id in data.shift_ids:
        source = locked_shift(db, user, shift_id, manage=True)
        if source.superseded_at is not None:
            continue
        db.execute(select(Employee.id).where(Employee.id == target.id).with_for_update()).one()
        if overlaps(db, user.organization_id, target.id, source.started_at, source.ended_at):
            raise HTTPException(409, "Kopiowanie koliduje z istniejącym grafikiem")
        row = ShiftAssignment(
            organization_id=user.organization_id,
            employee_id=target.id,
            template_id=source.template_id,
            started_at=source.started_at,
            ended_at=source.ended_at,
            kind=source.kind,
            color=source.color,
            note=source.note,
            flags=normalize_flags(source.flags),
        )
        db.add(row)
        db.flush()
        audit(db, user, "shift.copy", "shift_assignment", row.id, {"from": str(source.id)})
        created.append(shift_view(row))
    db.commit()
    return {"created": created, "count": len(created)}


@router.get("/calendar/day-types")
def list_day_types(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    employee_id: UUID | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if to_date < from_date:
        raise HTTPException(422, "Nieprawidłowy zakres dat")
    statement = select(CalendarDayType).where(
        CalendarDayType.organization_id == user.organization_id,
        CalendarDayType.day >= from_date,
        CalendarDayType.day <= to_date,
    )
    if employee_id:
        employee_or_404(db, user, employee_id, manage=False)
        statement = statement.where(CalendarDayType.employee_id == employee_id)
    rows = db.scalars(statement.order_by(CalendarDayType.day, CalendarDayType.employee_id)).all()
    visible = []
    for row in rows:
        employee = db.get(Employee, row.employee_id)
        if employee and can_read_employee(db, user, employee):
            visible.append(day_type_view(row))
    return visible


class DayTypePut(BaseModel):
    employee_id: UUID
    day: date
    code: DayTypeCode | None = None


@router.put("/calendar/day-types")
def put_day_type(data: DayTypePut, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    employee = employee_or_404(db, user, data.employee_id, manage=True)
    existing = db.scalar(
        select(CalendarDayType)
        .where(CalendarDayType.employee_id == employee.id, CalendarDayType.day == data.day)
        .with_for_update()
    )
    if data.code is None:
        if existing:
            audit(db, user, "day_type.delete", "calendar_day_type", existing.id)
            db.delete(existing)
            db.commit()
        return {"cleared": True}
    if data.code not in DAY_TYPE_CODES:
        raise HTTPException(422, "Nieprawidłowy typ dnia")
    if existing:
        existing.code = data.code
        audit(db, user, "day_type.update", "calendar_day_type", existing.id)
        db.commit()
        return day_type_view(existing)
    row = CalendarDayType(
        organization_id=user.organization_id,
        employee_id=employee.id,
        day=data.day,
        code=data.code,
    )
    db.add(row)
    db.flush()
    audit(db, user, "day_type.create", "calendar_day_type", row.id)
    db.commit()
    return day_type_view(row)


class DayTypeResetIn(BaseModel):
    employee_ids: list[UUID] = Field(min_length=1, max_length=200)
    from_date: date
    to_date: date


@router.post("/calendar/day-types/reset")
def reset_day_types(data: DayTypeResetIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr", "manager")
    for employee_id in data.employee_ids:
        employee_or_404(db, user, employee_id, manage=True)
    result = db.execute(
        delete(CalendarDayType).where(
            CalendarDayType.organization_id == user.organization_id,
            CalendarDayType.employee_id.in_(data.employee_ids),
            CalendarDayType.day >= data.from_date,
            CalendarDayType.day <= data.to_date,
        )
    )
    db.commit()
    return {"removed": result.rowcount or 0}


@router.get("/calendar/availability")
def list_availability(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    employee_id: UUID | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if to_date < from_date:
        raise HTTPException(422, "Nieprawidłowy zakres dat")
    statement = select(AvailabilityEntry).where(
        AvailabilityEntry.organization_id == user.organization_id,
        AvailabilityEntry.day >= from_date,
        AvailabilityEntry.day <= to_date,
    )
    if employee_id:
        employee_or_404(db, user, employee_id, manage=False)
        statement = statement.where(AvailabilityEntry.employee_id == employee_id)
    rows = db.scalars(statement.order_by(AvailabilityEntry.day, AvailabilityEntry.employee_id)).all()
    visible = []
    for row in rows:
        employee = db.get(Employee, row.employee_id)
        if employee and can_read_employee(db, user, employee):
            visible.append(availability_view(row))
    return visible


class AvailabilityPut(BaseModel):
    employee_id: UUID
    day: date
    status: AvailabilityStatus | None = None
    start_minute: int | None = Field(default=None, ge=0, lt=24 * 60)
    end_minute: int | None = Field(default=None, ge=0, le=24 * 60)


@router.put("/calendar/availability")
def put_availability(data: AvailabilityPut, user: User = Depends(current_user), db: Session = Depends(get_db)):
    mine = own_employee(db, user)
    if not mine or mine.id != data.employee_id:
        raise HTTPException(403, "Dostępność może ustawić tylko pracownik dla siebie")
    employee = employee_or_404(db, user, data.employee_id, manage=False)
    existing = db.scalar(
        select(AvailabilityEntry)
        .where(AvailabilityEntry.employee_id == employee.id, AvailabilityEntry.day == data.day)
        .with_for_update()
    )
    if data.status is None:
        if existing:
            audit(db, user, "availability.delete", "availability_entry", existing.id)
            db.delete(existing)
            db.commit()
        return {"cleared": True}
    if data.status == "hours":
        if data.start_minute is None or data.end_minute is None or data.end_minute <= data.start_minute:
            raise HTTPException(422, "Wymagany zakres godzin")
    start_m = data.start_minute if data.status == "hours" else None
    end_m = data.end_minute if data.status == "hours" else None
    if existing:
        existing.status = data.status
        existing.start_minute = start_m
        existing.end_minute = end_m
        audit(db, user, "availability.update", "availability_entry", existing.id)
        db.commit()
        return availability_view(existing)
    row = AvailabilityEntry(
        organization_id=user.organization_id,
        employee_id=employee.id,
        day=data.day,
        status=data.status,
        start_minute=start_m,
        end_minute=end_m,
    )
    db.add(row)
    db.flush()
    audit(db, user, "availability.create", "availability_entry", row.id)
    db.commit()
    return availability_view(row)


class AvailabilityResetIn(BaseModel):
    employee_ids: list[UUID] = Field(min_length=1, max_length=200)
    from_date: date
    to_date: date


@router.post("/calendar/availability/reset")
def reset_availability(data: AvailabilityResetIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    mine = own_employee(db, user)
    if not mine:
        raise HTTPException(403, "Brak powiązanego pracownika")
    if any(employee_id != mine.id for employee_id in data.employee_ids):
        raise HTTPException(403, "Możesz zresetować tylko własną dostępność")
    result = db.execute(
        delete(AvailabilityEntry).where(
            AvailabilityEntry.organization_id == user.organization_id,
            AvailabilityEntry.employee_id == mine.id,
            AvailabilityEntry.day >= data.from_date,
            AvailabilityEntry.day <= data.to_date,
        )
    )
    db.commit()
    return {"removed": result.rowcount or 0}
