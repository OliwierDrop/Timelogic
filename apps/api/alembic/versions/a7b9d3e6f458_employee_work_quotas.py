"""employee work quotas by year

Revision ID: a7b9d3e6f458
Revises: f6a8c2d5e347
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a7b9d3e6f458"
down_revision: Union[str, None] = "f6a8c2d5e347"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "employee_work_quotas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("daily_minutes", sa.Integer(), nullable=False, server_default="480"),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("employee_id", "year", name="uq_employee_work_quota_year"),
    )
    op.create_index(
        "ix_employee_work_quotas_employee_id",
        "employee_work_quotas",
        ["employee_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_employee_work_quotas_employee_id", table_name="employee_work_quotas")
    op.drop_table("employee_work_quotas")
