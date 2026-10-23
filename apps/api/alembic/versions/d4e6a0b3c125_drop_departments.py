"""drop departments and manager_departments

Revision ID: d4e6a0b3c125
Revises: c3d5f9a2b014
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e6a0b3c125"
down_revision: Union[str, None] = "c3d5f9a2b014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("employees_organization_id_department_id_fkey", "employees", type_="foreignkey")
    op.drop_column("employees", "department_id")
    op.drop_table("manager_departments")
    op.drop_table("departments")


def downgrade() -> None:
    op.create_table(
        "departments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "id"),
        sa.UniqueConstraint("organization_id", "name"),
    )
    op.create_table(
        "manager_departments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "department_id"),
    )
    op.add_column("employees", sa.Column("department_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "employees_organization_id_department_id_fkey",
        "employees",
        "departments",
        ["organization_id", "department_id"],
        ["organization_id", "id"],
    )
