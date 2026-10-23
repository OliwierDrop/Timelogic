from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .db import get_db
from .employment import CONTRACT_EMPLOYMENT, employment_term_as_of
from .models import Employee, LeaveBalance, LeaveRequest, LeaveType, User
from .security import (
    can_read_employee,
    current_user,
    employee_or_404,
    now,
    own_employee,
    require_role,
    role_codes,
)


router = APIRouter(tags=["Nieobecności"])

DEFAULT_LEAVE_TYPES = (
    {"code": "op", "name": "Opieka nad dzieckiem", "category": "leave", "sort_order": 10, "allows_carry_over": True},
    {"code": "um", "name": "Urlop macierzyński", "category": "leave", "sort_order": 20, "allows_carry_over": True},
    {"code": "uo", "name": "Urlop ojcowski", "category": "leave", "sort_order": 30, "allows_carry_over": True},
    {
        "code": "ur2",
        "name": "Urlop rodzicielski - drugi rodzic",
        "category": "leave",
        "sort_order": 40,
        "allows_carry_over": True,
    },
    {
        "code": "ur",
        "name": "Urlop rodzicielski - pierwszy rodzic",
        "category": "leave",
        "sort_order": 50,
        "allows_carry_over": True,
    },
    {"code": "uwy", "name": "Urlop wychowawczy", "category": "leave", "sort_order": 60, "allows_carry_over": True},
    {"code": "uw", "name": "Urlop wypoczynkowy", "category": "leave", "sort_order": 70, "allows_carry_over": True},
    {
        "code": "uwz",
        "name": "Urlop wypoczynkowy „na żądanie”",
        "category": "leave",
        "sort_order": 80,
        "allows_carry_over": False,
    },
    {
        "code": "zsw",
        "name": "Zwolnienie od pracy z powodu działania siły wyższej",
        "category": "leave",
        "sort_order": 90,
        "allows_carry_over": True,
    },
    {"code": "pz", "name": "Praca zdalna", "category": "custom", "sort_order": 10, "allows_carry_over": False},
)


def audit(db: Session, user: User, action: str, kind: str, target: UUID, detail=None):
    from .main import audit as write_audit

    write_audit(db, user, action, kind, target, detail)


def can_decide(db: Session, user: User) -> bool:
    return bool(role_codes(db, user).intersection({"admin", "hr", "manager"}))


def day_count(start: date, end: date) -> int:
    return (end - start).days + 1


def ensure_org_leave_types(db: Session, organization_id: UUID) -> list[LeaveType]:
    existing = {
        row.code: row
        for row in db.scalars(select(LeaveType).where(LeaveType.organization_id == organization_id)).all()
    }
    created = False
    for spec in DEFAULT_LEAVE_TYPES:
        if spec["code"] in existing:
            continue
        db.add(
            LeaveType(
                organization_id=organization_id,
                code=spec["code"],
                name=spec["name"],
                category=spec["category"],
                sort_order=spec["sort_order"],
                allows_carry_over=spec["allows_carry_over"],
            )
        )
        created = True
    if created:
        db.flush()
    return list(
        db.scalars(
            select(LeaveType)
            .where(LeaveType.organization_id == organization_id)
            .order_by(LeaveType.category, LeaveType.sort_order, LeaveType.name, LeaveType.id)
        ).all()
    )


def type_view(row: LeaveType):
    return {
        "id": str(row.id),
        "code": row.code,
        "name": row.name,
        "category": row.category or "leave",
        "sort_order": int(row.sort_order or 0),
        "allows_carry_over": bool(row.allows_carry_over),
    }


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


def balance_view(db: Session, row: LeaveBalance, leave_type: LeaveType | None = None):
    used = used_days(db, row.employee_id, row.leave_type_id, row.year)
    granted = float(row.granted_days)
    unlimited = bool(row.unlimited)
    leave_type = leave_type or db.get(LeaveType, row.leave_type_id)
    return {
        "id": str(row.id),
        "employee_id": str(row.employee_id),
        "leave_type_id": str(row.leave_type_id),
        "leave_type_code": leave_type.code if leave_type else None,
        "leave_type_name": leave_type.name if leave_type else None,
        "category": (leave_type.category if leave_type else None) or "leave",
        "allows_carry_over": bool(leave_type.allows_carry_over) if leave_type else False,
        "year": row.year,
        "granted_days": granted,
        "used_days": used,
        "remaining_days": None if unlimited else granted - used,
        "unlimited": unlimited,
        "carry_over": bool(row.carry_over),
        "period": row.period,
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


def assert_balance_allows(
    db: Session,
    employee_id: UUID,
    leave_type_id: UUID,
    year: int,
    days: int,
    exclude_id: UUID | None = None,
):
    balance = db.scalar(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.year == year,
        )
    )
    if balance is None:
        return
    if balance.unlimited:
        return
    remaining = float(balance.granted_days) - used_days(
        db, employee_id, leave_type_id, year, exclude_id=exclude_id
    )
    if days > remaining:
        raise HTTPException(409, "Brak wystarczającego salda dni")


@router.get("/leave-types")
def list_types(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = ensure_org_leave_types(db, user.organization_id)
    db.commit()
    return [type_view(x) for x in rows]


class LeaveTypeIn(BaseModel):
    code: str = Field(min_length=2, max_length=30, pattern=r"^[a-z0-9_-]+$")
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(default="leave", pattern=r"^(leave|custom)$")


@router.post("/leave-types", status_code=201)
def create_type(data: LeaveTypeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    ensure_org_leave_types(db, user.organization_id)
    code = data.code.strip().lower()
    if db.scalar(
        select(LeaveType.id).where(LeaveType.organization_id == user.organization_id, LeaveType.code == code)
    ):
        raise HTTPException(409, "Typ o tym kodzie już istnieje")
    row = LeaveType(
        organization_id=user.organization_id,
        code=code,
        name=data.name.strip(),
        category=data.category,
        sort_order=1000,
        allows_carry_over=data.category == "leave",
    )
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
    unlimited: bool = False
    carry_over: bool = False
    period: str | None = Field(default=None, pattern=r"^(year|month)$")


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
    period = data.period if leave_type.category == "custom" and not data.unlimited else None
    row = db.scalar(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == data.employee_id,
            LeaveBalance.leave_type_id == data.leave_type_id,
            LeaveBalance.year == data.year,
        )
    )
    if row:
        row.granted_days = 0 if data.unlimited else data.granted_days
        row.unlimited = data.unlimited
        row.carry_over = data.carry_over if leave_type.allows_carry_over else False
        row.period = period
        audit(db, user, "leave.balance.update", "leave_balance", row.id)
    else:
        row = LeaveBalance(
            organization_id=user.organization_id,
            employee_id=data.employee_id,
            leave_type_id=data.leave_type_id,
            year=data.year,
            granted_days=0 if data.unlimited else data.granted_days,
            unlimited=data.unlimited,
            carry_over=data.carry_over if leave_type.allows_carry_over else False,
            period=period,
        )
        db.add(row)
        db.flush()
        audit(db, user, "leave.balance.create", "leave_balance", row.id)
    db.commit()
    return balance_view(db, row, leave_type)


class RequestLimitIn(BaseModel):
    leave_type_id: UUID | None = None
    code: str | None = None
    year: int = Field(ge=2000, le=2100)
    granted_days: float = Field(default=0, ge=0, le=366)
    unlimited: bool = False
    carry_over: bool = False
    period: str | None = Field(default=None, pattern=r"^(year|month)$")


@router.get("/employees/{employee_id}/request-limits")
def get_request_limits(
    employee_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    employee_or_404(db, user, employee_id, manage=False)
    types = ensure_org_leave_types(db, user.organization_id)
    db.commit()
    type_by_id = {row.id: row for row in types}
    rows = db.scalars(
        select(LeaveBalance)
        .where(LeaveBalance.employee_id == employee_id)
        .order_by(LeaveBalance.year, LeaveBalance.leave_type_id)
    ).all()
    leave_rows = []
    custom_rows = []
    leave_years: set[int] = set()
    custom_years: set[int] = set()
    for row in rows:
        leave_type = type_by_id.get(row.leave_type_id) or db.get(LeaveType, row.leave_type_id)
        if not leave_type:
            continue
        view = balance_view(db, row, leave_type)
        if leave_type.category == "custom":
            custom_rows.append(view)
            custom_years.add(row.year)
        else:
            leave_rows.append(view)
            leave_years.add(row.year)
    return {
        "leave_years": sorted(leave_years),
        "custom_years": sorted(custom_years),
        "leave": leave_rows,
        "custom": custom_rows,
        "types": [type_view(x) for x in types],
    }


@router.put("/employees/{employee_id}/request-limits")
def put_request_limits(
    employee_id: UUID,
    data: list[RequestLimitIn],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_role(db, user, "admin", "hr")
    employee_or_404(db, user, employee_id, manage=True)
    types = ensure_org_leave_types(db, user.organization_id)
    by_id = {row.id: row for row in types}
    by_code = {row.code: row for row in types}
    seen: set[tuple[UUID, int]] = set()
    prepared: list[tuple[LeaveType, RequestLimitIn]] = []
    for item in data:
        leave_type = None
        if item.leave_type_id:
            leave_type = by_id.get(item.leave_type_id)
        elif item.code:
            leave_type = by_code.get(item.code.strip().lower())
        if not leave_type:
            raise HTTPException(422, "Nieprawidłowy typ wniosku")
        key = (leave_type.id, item.year)
        if key in seen:
            raise HTTPException(422, "Powtórzony typ i rok w limitach")
        seen.add(key)
        prepared.append((leave_type, item))

    db.execute(delete(LeaveBalance).where(LeaveBalance.employee_id == employee_id))
    for leave_type, item in prepared:
        unlimited = bool(item.unlimited)
        carry_over = bool(item.carry_over) if leave_type.allows_carry_over else False
        period = item.period if leave_type.category == "custom" and not unlimited else None
        if leave_type.category == "custom" and not unlimited and period not in ("year", "month"):
            period = "month"
        db.add(
            LeaveBalance(
                organization_id=user.organization_id,
                employee_id=employee_id,
                leave_type_id=leave_type.id,
                year=item.year,
                granted_days=0 if unlimited else item.granted_days,
                unlimited=unlimited,
                carry_over=carry_over,
                period=period,
            )
        )
    audit(
        db,
        user,
        "employee.request_limits",
        "employee",
        employee_id,
        {"count": len(prepared)},
    )
    db.commit()
    return get_request_limits(employee_id, user, db)


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
    if (leave_type.category or "leave") == "leave":
        term = employment_term_as_of(db, employee.id, data.start_date)
        if not term or term.contract_type != CONTRACT_EMPLOYMENT:
            raise HTTPException(
                422,
                "Wnioski urlopowe wymagają umowy o pracę obowiązującej w dniu rozpoczęcia",
            )
    if overlapping_leave(db, employee.id, data.start_date, data.end_date):
        raise HTTPException(409, "Wniosek nakłada się na inną nieobecność")
    days = day_count(data.start_date, data.end_date)
    assert_balance_allows(db, employee.id, leave_type.id, data.start_date.year, days)
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
        leave_type = db.get(LeaveType, row.leave_type_id)
        if leave_type and (leave_type.category or "leave") == "leave":
            term = employment_term_as_of(db, row.employee_id, row.start_date)
            if not term or term.contract_type != CONTRACT_EMPLOYMENT:
                raise HTTPException(
                    422,
                    "Wnioski urlopowe wymagają umowy o pracę obowiązującej w dniu rozpoczęcia",
                )
        days = day_count(row.start_date, row.end_date)
        assert_balance_allows(
            db, row.employee_id, row.leave_type_id, row.start_date.year, days, exclude_id=row.id
        )
    row.status = "approved" if data.approve else "rejected"
    row.decided_by_id = user.id
    row.decided_at = now()
    audit(db, user, "leave.decision", "leave_request", row.id, {"status": row.status})
    db.commit()
    return request_view(row)
