"""calendar shift versioning, day types, availability

Revision ID: f2a4c6e8b901
Revises: e1f3b7c0d892
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f2a4c6e8b901"
down_revision: Union[str, None] = "e1f3b7c0d892"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "shift_assignments",
        sa.Column("kind", sa.String(length=20), nullable=False, server_default="standard"),
    )
    op.add_column("shift_assignments", sa.Column("color", sa.String(length=20), nullable=True))
    op.add_column("shift_assignments", sa.Column("note", sa.Text(), nullable=True))
    op.add_column(
        "shift_assignments",
        sa.Column("flags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "shift_assignments",
        sa.Column("replaces_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "shift_assignments",
        sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_shift_assignments_replaces_id",
        "shift_assignments",
        "shift_assignments",
        ["replaces_id"],
        ["id"],
    )
    op.create_index("ix_shift_assignments_replaces_id", "shift_assignments", ["replaces_id"])
    op.create_index("ix_shift_assignments_superseded_at", "shift_assignments", ["superseded_at"])

    op.create_table(
        "calendar_day_types",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("code", sa.String(length=10), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("employee_id", "day", name="uq_calendar_day_types_employee_day"),
        sa.CheckConstraint("code IN ('P', 'ND', 'SW', 'TP5', 'HW')", name="calendar_day_type_code"),
    )
    op.create_index("ix_calendar_day_types_org", "calendar_day_types", ["organization_id"])
    op.create_index("ix_calendar_day_types_employee", "calendar_day_types", ["employee_id"])

    op.create_table(
        "availability_entries",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("start_minute", sa.Integer(), nullable=True),
        sa.Column("end_minute", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("employee_id", "day", name="uq_availability_entries_employee_day"),
        sa.CheckConstraint(
            "status IN ('available', 'hours', 'unavailable')",
            name="availability_status",
        ),
    )
    op.create_index("ix_availability_entries_org", "availability_entries", ["organization_id"])
    op.create_index("ix_availability_entries_employee", "availability_entries", ["employee_id"])


def downgrade() -> None:
    op.drop_table("availability_entries")
    op.drop_table("calendar_day_types")
    op.drop_index("ix_shift_assignments_superseded_at", table_name="shift_assignments")
    op.drop_index("ix_shift_assignments_replaces_id", table_name="shift_assignments")
    op.drop_constraint("fk_shift_assignments_replaces_id", "shift_assignments", type_="foreignkey")
    op.drop_column("shift_assignments", "superseded_at")
    op.drop_column("shift_assignments", "replaces_id")
    op.drop_column("shift_assignments", "flags")
    op.drop_column("shift_assignments", "note")
    op.drop_column("shift_assignments", "color")
    op.drop_column("shift_assignments", "kind")
