from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import AttendanceCorrection, BreakEntry, Employee, IdempotencyRecord, TimeEntry, User
from .security import can_manage_employee, current_user, employee_or_404, now, own_employee, role_codes


router = APIRouter(tags=["RCP"])


def audit(db: Session, user: User, action: str, kind: str, target: UUID, detail=None):
    from .main import audit as write_audit

    write_audit(db, user, action, kind, target, detail)


def entry_view(db: Session, row: TimeEntry):
    breaks = db.scalars(
        select(BreakEntry).where(BreakEntry.time_entry_id == row.id).order_by(BreakEntry.started_at)
    ).all()
    return {
        "id": str(row.id),
        "employee_id": str(row.employee_id),
        "started_at": row.started_at.isoformat(),
        "ended_at": row.ended_at.isoformat() if row.ended_at else None,
        "version": row.version,
        "breaks": [
            {
                "id": str(x.id),
                "started_at": x.started_at.isoformat(),
                "ended_at": x.ended_at.isoformat() if x.ended_at else None,
                "paid": x.paid,
            }
            for x in breaks
        ],
    }


def own_or_managed(db: Session, user: User, employee_id: UUID | None, manage=False):
    if employee_id is None:
        employee = own_employee(db, user)
        if not employee:
            raise HTTPException(404, "Brak powiązanej karty pracownika")
        return employee
    return employee_or_404(db, user, employee_id, manage=manage)


def idempotency(db: Session, user: User, key: str, operation: str):
    if not key or len(key) > 100:
        raise HTTPException(422, "Wymagany Idempotency-Key")
    row = db.scalar(select(IdempotencyRecord).where(IdempotencyRecord.user_id == user.id, IdempotencyRecord.key == key))
    if row and row.operation != operation:
        raise HTTPException(409, "Klucz użyty dla innej operacji")
    return row


def remember(db: Session, user: User, key: str, operation: str, target: UUID, response: dict):
    db.add(IdempotencyRecord(user_id=user.id, key=key, operation=operation, target_id=target, response=response))


@router.get("/time-entries")
def entries(
    employee_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    employee = own_or_managed(db, user, employee_id)
    rows = db.scalars(
        select(TimeEntry)
        .where(TimeEntry.organization_id == user.organization_id, TimeEntry.employee_id == employee.id)
        .order_by(TimeEntry.started_at.desc(), TimeEntry.id)
        .limit(max(1, min(limit, 100)))
        .offset(max(0, offset))
    ).all()
    return [entry_view(db, x) for x in rows]


class StartIn(BaseModel):
    employee_id: UUID | None = None


@router.post("/time-entries", status_code=201)
def start(
    data: StartIn,
    idempotency_key: str = Header(alias="Idempotency-Key"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    employee = own_or_managed(db, user, data.employee_id, manage=data.employee_id is not None)
    db.execute(select(Employee.id).where(Employee.id == employee.id).with_for_update()).one()
    previous = idempotency(db, user, idempotency_key, f"start:{employee.id}")
    if previous:
        return previous.response
    if not employee.active:
        raise HTTPException(409, "Pracownik nieaktywny")
    if db.scalar(
        select(TimeEntry.id).where(
            TimeEntry.employee_id == employee.id, or_(TimeEntry.ended_at.is_(None), TimeEntry.ended_at > now())
        )
    ):
        raise HTTPException(409, "Przedział pracy nakłada się na inny wpis")
    row = TimeEntry(organization_id=user.organization_id, employee_id=employee.id, started_at=now())
    db.add(row)
    db.flush()
    result = entry_view(db, row)
    remember(db, user, idempotency_key, f"start:{employee.id}", row.id, result)
    audit(db, user, "time.start", "time_entry", row.id)
    db.commit()
    return result


def locked_entry(db: Session, user: User, entry_id: UUID):
    existing = db.scalar(
        select(TimeEntry).where(TimeEntry.id == entry_id, TimeEntry.organization_id == user.organization_id)
    )
    if not existing:
        raise HTTPException(404, "Nie znaleziono wpisu")
    own_or_managed(
        db,
        user,
        existing.employee_id,
        manage=existing.employee_id != (own_employee(db, user).id if own_employee(db, user) else None),
    )
    db.execute(select(Employee.id).where(Employee.id == existing.employee_id).with_for_update()).one()
    row = db.scalar(
        select(TimeEntry)
        .where(TimeEntry.id == entry_id, TimeEntry.organization_id == user.organization_id)
        .with_for_update()
    )
    if not row:
        raise HTTPException(404, "Nie znaleziono wpisu")
    return row


@router.post("/time-entries/{entry_id}/stop")
def stop(
    entry_id: UUID,
    idempotency_key: str = Header(alias="Idempotency-Key"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = locked_entry(db, user, entry_id)
    previous = idempotency(db, user, idempotency_key, f"stop:{entry_id}")
    if previous:
        return previous.response
    if row.ended_at:
        raise HTTPException(409, "Praca już zakończona")
    if db.scalar(select(BreakEntry.id).where(BreakEntry.time_entry_id == row.id, BreakEntry.ended_at.is_(None))):
        raise HTTPException(409, "Najpierw zakończ przerwę")
    row.ended_at = now()
    if db.scalar(
        select(TimeEntry.id).where(
            TimeEntry.employee_id == row.employee_id,
            TimeEntry.id != row.id,
            TimeEntry.started_at < row.ended_at,
            or_(TimeEntry.ended_at.is_(None), TimeEntry.ended_at > row.started_at),
        )
    ):
        raise HTTPException(409, "Przedział nakłada się na inny wpis")
    row.version += 1
    result = entry_view(db, row)
    remember(db, user, idempotency_key, f"stop:{entry_id}", row.id, result)
    audit(db, user, "time.stop", "time_entry", row.id)
    db.commit()
    return result


class BreakIn(BaseModel):
    paid: bool = True


@router.post("/time-entries/{entry_id}/breaks", status_code=201)
def start_break(
    entry_id: UUID,
    data: BreakIn,
    idempotency_key: str = Header(alias="Idempotency-Key"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = locked_entry(db, user, entry_id)
    operation = f"break.start:{entry_id}:{data.paid}"
    previous = idempotency(db, user, idempotency_key, operation)
    if previous:
        return previous.response
    if row.ended_at:
        raise HTTPException(409, "Praca zakończona")
    if db.scalar(select(BreakEntry.id).where(BreakEntry.time_entry_id == row.id, BreakEntry.ended_at.is_(None))):
        raise HTTPException(409, "Przerwa już rozpoczęta")
    br = BreakEntry(organization_id=user.organization_id, time_entry_id=row.id, started_at=now(), paid=data.paid)
    db.add(br)
    db.flush()
    result = entry_view(db, row)
    remember(db, user, idempotency_key, operation, br.id, result)
    audit(db, user, "break.start", "break_entry", br.id)
    db.commit()
    return result


@router.post("/time-entries/{entry_id}/breaks/{break_id}/stop")
def stop_break(
    entry_id: UUID,
    break_id: UUID,
    idempotency_key: str = Header(alias="Idempotency-Key"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = locked_entry(db, user, entry_id)
    previous = idempotency(db, user, idempotency_key, f"break.stop:{break_id}")
    if previous:
        return previous.response
    br = db.scalar(
        select(BreakEntry).where(BreakEntry.id == break_id, BreakEntry.time_entry_id == entry_id).with_for_update()
    )
    if not br:
        raise HTTPException(404, "Nie znaleziono przerwy")
    if br.ended_at:
        raise HTTPException(409, "Przerwa już zakończona")
    br.ended_at = now()
    result = entry_view(db, row)
    remember(db, user, idempotency_key, f"break.stop:{break_id}", br.id, result)
    audit(db, user, "break.stop", "break_entry", br.id)
    db.commit()
    return result


class CorrectionIn(BaseModel):
    time_entry_id: UUID
    proposed_start: datetime
    proposed_end: datetime
    reason: str = Field(min_length=5, max_length=2000)


@router.post("/attendance-corrections", status_code=201)
def create_correction(data: CorrectionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(TimeEntry, data.time_entry_id)
    if not row or row.organization_id != user.organization_id:
        raise HTTPException(404, "Nie znaleziono wpisu")
    own_or_managed(db, user, row.employee_id)
    if (
        not row.ended_at
        or data.proposed_start.tzinfo is None
        or data.proposed_end.tzinfo is None
        or data.proposed_end <= data.proposed_start
    ):
        raise HTTPException(422, "Nieprawidłowy przedział czasu")
    correction = AttendanceCorrection(
        organization_id=user.organization_id,
        time_entry_id=row.id,
        requester_id=user.id,
        reason=data.reason,
        proposed_start=data.proposed_start,
        proposed_end=data.proposed_end,
        before={"started_at": row.started_at.isoformat(), "ended_at": row.ended_at.isoformat(), "version": row.version},
    )
    db.add(correction)
    db.flush()
    audit(db, user, "correction.request", "attendance_correction", correction.id)
    db.commit()
    return correction_view(db, correction)


def correction_view(db: Session, row: AttendanceCorrection):
    entry = db.get(TimeEntry, row.time_entry_id)
    return {
        "id": str(row.id),
        "time_entry_id": str(row.time_entry_id),
        "employee_id": str(entry.employee_id),
        "status": row.status,
        "reason": row.reason,
        "proposed_start": row.proposed_start.isoformat(),
        "proposed_end": row.proposed_end.isoformat(),
        "created_at": row.created_at.isoformat(),
    }


@router.get("/attendance-corrections")
def corrections(user: User = Depends(current_user), db: Session = Depends(get_db)):
    roles = role_codes(db, user)
    statement = select(AttendanceCorrection).where(AttendanceCorrection.organization_id == user.organization_id)
    if not roles.intersection({"admin", "hr", "manager"}):
        statement = statement.where(AttendanceCorrection.requester_id == user.id)
    rows = db.scalars(statement.order_by(AttendanceCorrection.created_at.desc()).limit(100)).all()
    if "manager" in roles and not roles.intersection({"admin", "hr"}):
        rows = [
            x
            for x in rows
            if can_manage_employee(db, user, db.get(Employee, db.get(TimeEntry, x.time_entry_id).employee_id))
            or x.requester_id == user.id
        ]
    return [correction_view(db, x) for x in rows]


class DecisionIn(BaseModel):
    approve: bool


@router.post("/attendance-corrections/{correction_id}/decision")
def decide_correction(
    correction_id: UUID, data: DecisionIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    correction = db.scalar(
        select(AttendanceCorrection)
        .where(AttendanceCorrection.id == correction_id, AttendanceCorrection.organization_id == user.organization_id)
        .with_for_update()
    )
    if not correction:
        raise HTTPException(404, "Nie znaleziono korekty")
    existing = db.get(TimeEntry, correction.time_entry_id)
    if not existing:
        raise HTTPException(404, "Nie znaleziono wpisu")
    employee_or_404(db, user, existing.employee_id, manage=True)
    db.execute(select(Employee.id).where(Employee.id == existing.employee_id).with_for_update()).one()
    row = db.scalar(select(TimeEntry).where(TimeEntry.id == correction.time_entry_id).with_for_update())
    if correction.status != "pending":
        raise HTTPException(409, "Korekta już rozpatrzona")
    if data.approve:
        if row.version != correction.before["version"]:
            raise HTTPException(409, "Wpis zmienił się od zgłoszenia korekty")
        overlaps = db.scalar(
            select(TimeEntry.id).where(
                TimeEntry.employee_id == row.employee_id,
                TimeEntry.id != row.id,
                TimeEntry.started_at < correction.proposed_end,
                or_(TimeEntry.ended_at.is_(None), TimeEntry.ended_at > correction.proposed_start),
            )
        )
        if overlaps:
            raise HTTPException(409, "Przedział nakłada się na inny wpis")
        invalid_break = db.scalar(
            select(BreakEntry.id).where(
                BreakEntry.time_entry_id == row.id,
                or_(BreakEntry.started_at < correction.proposed_start, BreakEntry.ended_at > correction.proposed_end),
            )
        )
        if invalid_break:
            raise HTTPException(409, "Korekta wykracza poza zapisane przerwy")
        row.started_at, row.ended_at = correction.proposed_start, correction.proposed_end
        row.version += 1
        correction.after = {
            "started_at": row.started_at.isoformat(),
            "ended_at": row.ended_at.isoformat(),
            "version": row.version,
        }
    correction.status = "approved" if data.approve else "rejected"
    correction.decided_by_id, correction.decided_at = user.id, now()
    audit(db, user, "correction.decision", "attendance_correction", correction.id, {"status": correction.status})
    db.commit()
    return correction_view(db, correction)
