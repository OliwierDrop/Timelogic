"""Create the first organization, administrator account, and linked team card."""

import os
import sys

from sqlalchemy import select

from .db import SessionLocal
from .models import AuditLog, Employee, Organization, Role, User, UserRole
from .security import hashing


def main():
    email = os.getenv("BOOTSTRAP_EMAIL", "").strip().lower()
    password = os.getenv("BOOTSTRAP_PASSWORD", "")
    name = os.getenv("BOOTSTRAP_ORGANIZATION", "Moja organizacja").strip()
    first_name = os.getenv("BOOTSTRAP_FIRST_NAME", "Administrator").strip() or "Administrator"
    last_name = os.getenv("BOOTSTRAP_LAST_NAME", "System").strip() or "System"
    if not email or "@" not in email or len(password) < 12 or not name:
        sys.exit("Ustaw BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD (min. 12 znaków) i nazwę organizacji")
    with SessionLocal.begin() as db:
        if db.scalar(select(Organization.id).limit(1)):
            sys.exit("Organizacja już istnieje; bootstrap działa tylko na pustej bazie")
        organization = Organization(name=name)
        db.add(organization)
        db.flush()
        roles = {}
        for code in ("employee", "manager", "hr", "admin"):
            role = Role(organization_id=organization.id, code=code)
            db.add(role)
            db.flush()
            roles[code] = role
        user = User(organization_id=organization.id, email=email, password_hash=hashing.hash(password))
        db.add(user)
        db.flush()
        db.add(UserRole(user_id=user.id, role_id=roles["admin"].id))
        employee = Employee(
            organization_id=organization.id,
            user_id=user.id,
            employee_number="0001",
            first_name=first_name,
            last_name=last_name,
            active=True,
        )
        db.add(employee)
        db.flush()
        db.add(
            AuditLog(
                organization_id=organization.id,
                actor_id=user.id,
                action="organization.bootstrap",
                target_type="organization",
                target_id=organization.id,
            )
        )
        print(f"Utworzono organizację, administratora i kartę w Zespole: {email} ({employee.employee_number})")


if __name__ == "__main__":
    main()
