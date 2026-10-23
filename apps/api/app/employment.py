from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import EmployeeEmploymentTerm

CONTRACT_EMPLOYMENT = "employment"
CONTRACT_MANDATE = "mandate"
CONTRACT_SPECIFIC_TASK = "specific_task"
CONTRACT_TYPES = (CONTRACT_EMPLOYMENT, CONTRACT_MANDATE, CONTRACT_SPECIFIC_TASK)


def employment_term_as_of(
    db: Session, employee_id: UUID, on: date
) -> EmployeeEmploymentTerm | None:
    return db.scalar(
        select(EmployeeEmploymentTerm)
        .where(
            EmployeeEmploymentTerm.employee_id == employee_id,
            EmployeeEmploymentTerm.effective_from <= on,
        )
        .order_by(EmployeeEmploymentTerm.effective_from.desc())
        .limit(1)
    )


def term_view(row: EmployeeEmploymentTerm) -> dict:
    return {
        "id": str(row.id),
        "employee_id": str(row.employee_id),
        "effective_from": row.effective_from.isoformat(),
        "contract_type": row.contract_type,
        "daily_minutes": row.daily_minutes,
    }
