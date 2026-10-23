from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Employee, LeaveBalance, LeaveRequest, LeaveType, User
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


router = APIRouter(tags=["Nieobecności"])


def audit(db: Session, user: User, action: str, kind: str, target: UUID, detail=None):
    from .main import audit as write_audit

    write_audit(db, user, action, kind, target, detail)


def can_decide(db: Session, user: User) -> bool:
    return bool(role_codes(db, user).intersection({"admin", "hr", "manager"}))


def day_count(start: date, end: date) -> int:
    return (end - start).days + 1


def type_view(row: LeaveType):
    return {"id": str(row.id), "code": row.code, "name": row.name}


def request_view(row: LeaveRequest):
    return {
        "id": str(row.id),
        "employee_id": str(row.employee_id),
        "leave_type_id": str(row.leave_type_id),
        "start_date": row.start_date.isoformat(),
        "end_date": row.end_date.isoformat(),
        "days": day_count(row.start_date, row.end_date),
        "status": row.status,
        "reason": row.reason,
        "decided_at": row.decided_at.isoformat() if row.decided_at else None,
    }


def used_days(db: Session, employee_id: UUID, leave_type_id: UUID, year: int, exclude_id: UUID | None = None):
    statement = select(LeaveRequest).where(
        LeaveRequest.employee_id == employee_id,
        LeaveRequest.leave_type_id == leave_type_id,
        LeaveRequest.status == "approved",
        LeaveRequest.start_date <= date(year, 12, 31),
        LeaveRequest.end_date >= date(year, 1, 1),
    )
    if exclude_id:
        statement = statement.where(LeaveRequest.id != exclude_id)
    total = 0.0
    for row in db.scalars(statement).all():
        total += day_count(row.start_date, row.end_date)
    return total


def balance_view(db: Session, row: LeaveBalance):
    used = used_days(db, row.employee_id, row.leave_type_id, row.year)
    granted = float(row.granted_days)
    return {
        "id": str(row.id),
        "employee_id": str(row.employee_id),
        "leave_type_id": str(row.leave_type_id),
        "year": row.year,
        "granted_days": granted,
        "used_days": used,
        "remaining_days": granted - used,
    }


def overlapping_leave(
    db: Session, employee_id: UUID, start: date, end: date, exclude_id: UUID | None = None
):
    statement = select(LeaveRequest.id).where(
        LeaveRequest.employee_id == employee_id,
        LeaveRequest.status.in_(("pending", "approved")),
        LeaveRequest.start_date <= end,
        LeaveRequest.end_date >= start,
    )
    if exclude_id:
        statement = statement.where(LeaveRequest.id != exclude_id)
    return db.scalar(statement) is not None


@router.get("/leave-types")
def list_types(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(LeaveType)
        .where(LeaveType.organization_id == user.organization_id)
        .order_by(LeaveType.name, LeaveType.id)
    ).all()
    return [type_view(x) for x in rows]


class LeaveTypeIn(BaseModel):
    code: str = Field(min_length=2, max_length=30, pattern=r"^[a-z0-9_-]+$")
    name: str = Field(min_length=2, max_length=120)


@router.post("/leave-types", status_code=201)
def create_type(data: LeaveTypeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    code = data.code.strip().lower()
    if db.scalar(
        select(LeaveType.id).where(LeaveType.organization_id == user.organization_id, LeaveType.code == code)
    ):
        raise HTTPException(409, "Typ o tym kodzie już istnieje")
    row = LeaveType(organization_id=user.organization_id, code=code, name=data.name.strip())
    db.add(row)
    db.flush()
    audit(db, user, "leave.type.create", "leave_type", row.id)
    db.commit()
    return type_view(row)


@router.get("/leave-balances")
def list_balances(
    employee_id: UUID | None = None,
    year: int | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    year = year or now().year
    statement = select(LeaveBalance).where(
        LeaveBalance.organization_id == user.organization_id, LeaveBalance.year == year
    )
    if employee_id:
        employee_or_404(db, user, employee_id, manage=False)
        statement = statement.where(LeaveBalance.employee_id == employee_id)
    rows = db.scalars(statement.order_by(LeaveBalance.employee_id, LeaveBalance.leave_type_id)).all()
    visible = []
    for row in rows:
        employee = db.get(Employee, row.employee_id)
        if employee and can_read_employee(db, user, employee):
            visible.append(balance_view(db, row))
    return visible


class BalanceIn(BaseModel):
    employee_id: UUID
    leave_type_id: UUID
    year: int = Field(ge=2000, le=2100)
    granted_days: float = Field(ge=0, le=366)


@router.post("/leave-balances", status_code=201)
def upsert_balance(data: BalanceIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    employee_or_404(db, user, data.employee_id, manage=True)
    leave_type = db.scalar(
        select(LeaveType).where(
            LeaveType.id == data.leave_type_id, LeaveType.organization_id == user.organization_id
        )
    )
    if not leave_type:
        raise HTTPException(422, "Nieprawidłowy typ nieobecności")
    row = db.scalar(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == data.employee_id,
            LeaveBalance.leave_type_id == data.leave_type_id,
            LeaveBalance.year == data.year,
        )
    )
    if row:
        row.granted_days = data.granted_days
        audit(db, user, "leave.balance.update", "leave_balance", row.id)
    else:
        row = LeaveBalance(
            organization_id=user.organization_id,
            employee_id=data.employee_id,
            leave_type_id=data.leave_type_id,
            year=data.year,
            granted_days=data.granted_days,
        )
        db.add(row)
        db.flush()
        audit(db, user, "leave.balance.create", "leave_balance", row.id)
    db.commit()
    return balance_view(db, row)


@router.get("/leave-requests")
def list_requests(
    status: str | None = Query(None, pattern=r"^(pending|approved|rejected)$"),
    employee_id: UUID | None = None,
    limit: int = 100,
    offset: int = 0,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    statement = select(LeaveRequest).where(LeaveRequest.organization_id == user.organization_id)
    if status:
        statement = statement.where(LeaveRequest.status == status)
    if employee_id:
        employee_or_404(db, user, employee_id, manage=False)
        statement = statement.where(LeaveRequest.employee_id == employee_id)
    rows = db.scalars(
        statement.order_by(LeaveRequest.start_date.desc(), LeaveRequest.id)
        .limit(max(1, min(limit, 200)))
        .offset(max(0, offset))
    ).all()
    visible = []
    for row in rows:
        employee = db.get(Employee, row.employee_id)
        if employee and can_read_employee(db, user, employee):
            visible.append(request_view(row))
    return visible


class LeaveRequestIn(BaseModel):
    employee_id: UUID | None = None
    leave_type_id: UUID
    start_date: date
    end_date: date
    reason: str | None = Field(default=None, max_length=2000)


@router.post("/leave-requests", status_code=201)
def create_request(data: LeaveRequestIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if data.end_date < data.start_date:
        raise HTTPException(422, "Data końcowa nie może poprzedzać początkowej")
    if data.employee_id:
        employee = employee_or_404(db, user, data.employee_id, manage=True)
    else:
        employee = own_employee(db, user)
        if not employee:
            raise HTTPException(404, "Brak powiązanej karty pracownika")
    leave_type = db.scalar(
        select(LeaveType).where(
            LeaveType.id == data.leave_type_id, LeaveType.organization_id == user.organization_id
        )
    )
    if not leave_type:
        raise HTTPException(422, "Nieprawidłowy typ nieobecności")
    if overlapping_leave(db, employee.id, data.start_date, data.end_date):
        raise HTTPException(409, "Wniosek nakłada się na inną nieobecność")
    days = day_count(data.start_date, data.end_date)
    year = data.start_date.year
    balance = db.scalar(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee.id,
            LeaveBalance.leave_type_id == leave_type.id,
            LeaveBalance.year == year,
        )
    )
    if balance is not None:
        remaining = float(balance.granted_days) - used_days(db, employee.id, leave_type.id, year)
        if days > remaining:
            raise HTTPException(409, "Brak wystarczającego salda dni")
    row = LeaveRequest(
        organization_id=user.organization_id,
        employee_id=employee.id,
        leave_type_id=leave_type.id,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=(data.reason or "").strip() or None,
        status="pending",
    )
    db.add(row)
    db.flush()
    audit(db, user, "leave.request", "leave_request", row.id, {"days": days})
    db.commit()
    return request_view(row)


class DecisionIn(BaseModel):
    approve: bool


@router.post("/leave-requests/{request_id}/decision")
def decide_request(
    request_id: UUID, data: DecisionIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    if not can_decide(db, user):
        raise HTTPException(403, "Brak uprawnienia")
    row = db.scalar(
        select(LeaveRequest)
        .where(LeaveRequest.id == request_id, LeaveRequest.organization_id == user.organization_id)
        .with_for_update()
    )
    if not row:
        raise HTTPException(404, "Nie znaleziono wniosku")
    employee_or_404(db, user, row.employee_id, manage=True)
    if row.status != "pending":
        raise HTTPException(409, "Wniosek już rozpatrzony")
    if data.approve and overlapping_leave(db, row.employee_id, row.start_date, row.end_date, exclude_id=row.id):
        raise HTTPException(409, "Akceptacja koliduje z inną nieobecnością")
    if data.approve:
        year = row.start_date.year
        balance = db.scalar(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == row.employee_id,
                LeaveBalance.leave_type_id == row.leave_type_id,
                LeaveBalance.year == year,
            )
        )
        if balance is not None:
            days = day_count(row.start_date, row.end_date)
            remaining = float(balance.granted_days) - used_days(
                db, row.employee_id, row.leave_type_id, year, exclude_id=row.id
            )
            if days > remaining:
                raise HTTPException(409, "Brak wystarczającego salda dni")
    row.status = "approved" if data.approve else "rejected"
    row.decided_by_id = user.id
    row.decided_at = now()
    audit(db, user, "leave.decision", "leave_request", row.id, {"status": row.status})
    db.commit()
    return request_view(row)
