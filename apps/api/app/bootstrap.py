"""Create the first organization and administrator from explicit environment variables."""

import os
import sys

from sqlalchemy import select

from .db import SessionLocal
from .models import AuditLog, Organization, Role, User, UserRole
from .security import hashing


def main():
    email = os.getenv("BOOTSTRAP_EMAIL", "").strip().lower()
    password = os.getenv("BOOTSTRAP_PASSWORD", "")
    name = os.getenv("BOOTSTRAP_ORGANIZATION", "Moja organizacja").strip()
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
        db.add(
            AuditLog(
                organization_id=organization.id,
                actor_id=user.id,
                action="organization.bootstrap",
                target_type="organization",
                target_id=organization.id,
            )
        )
        print(f"Utworzono organizację i administratora: {email}")


if __name__ == "__main__":
    main()
