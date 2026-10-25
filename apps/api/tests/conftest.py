import os
import tempfile
from datetime import date

import pytest

os.environ["DATABASE_URL"] = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://timelogic:change-this-local-password@localhost:55432/timelogic_test",
)
os.environ["COOKIE_SECURE"] = "false"
os.environ.setdefault("APP_SECRET", "test-app-secret-for-smtp")
os.environ.setdefault("UPLOAD_DIR", tempfile.mkdtemp(prefix="timelogic-uploads-"))
assert os.environ["DATABASE_URL"].endswith("/timelogic_test"), "Tests must use timelogic_test"

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import Employee, EmployeeEmploymentTerm, Organization, Role, User, UserRole  # noqa: E402
from app.security import hashing  # noqa: E402


@pytest.fixture
def seeded():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal.begin() as db:
        org = Organization(name="Test")
        other = Organization(name="Inna")
        db.add_all([org, other])
        db.flush()
        role_ids = {}
        for code in ("admin", "employee", "manager", "hr"):
            role = Role(organization_id=org.id, code=code)
            db.add(role)
            db.flush()
            role_ids[code] = role.id
        admin = User(
            organization_id=org.id, email="admin@example.com", password_hash=hashing.hash("strong-password-123")
        )
        worker = User(
            organization_id=org.id, email="worker@example.com", password_hash=hashing.hash("strong-password-123")
        )
        db.add_all([admin, worker])
        db.flush()
        db.add_all(
            [
                UserRole(user_id=admin.id, role_id=role_ids["admin"]),
                UserRole(user_id=worker.id, role_id=role_ids["employee"]),
            ]
        )
        employee = Employee(
            organization_id=org.id,
            user_id=worker.id,
            employee_number="T001",
            first_name="Jan",
            last_name="Testowy",
            hired_on=date(2024, 1, 1),
        )
        foreign = Employee(organization_id=other.id, employee_number="X001", first_name="Inny", last_name="Pracownik")
        db.add_all([employee, foreign])
        db.flush()
        db.add(
            EmployeeEmploymentTerm(
                employee_id=employee.id,
                effective_from=date(2024, 1, 1),
                contract_type="employment",
                daily_minutes=480,
            )
        )
        ids = {"employee": str(employee.id), "foreign": str(foreign.id)}
    yield ids
    Base.metadata.drop_all(engine)
