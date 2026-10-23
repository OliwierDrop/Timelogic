"""team tags and supervisor

Revision ID: b2c4e8f1a903
Revises: 09a967eae678
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c4e8f1a903"
down_revision: Union[str, None] = "09a967eae678"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "id"),
        sa.UniqueConstraint("organization_id", "name"),
    )
    op.create_table(
        "employee_tags",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("tag_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("employee_id", "tag_id"),
    )
    op.add_column("employees", sa.Column("supervisor_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_employees_supervisor",
        "employees",
        "employees",
        ["organization_id", "supervisor_id"],
        ["organization_id", "id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_employees_supervisor", "employees", type_="foreignkey")
    op.drop_column("employees", "supervisor_id")
    op.drop_table("employee_tags")
    op.drop_table("tags")
