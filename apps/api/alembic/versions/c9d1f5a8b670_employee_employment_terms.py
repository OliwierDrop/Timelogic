"""employee employment terms history

Revision ID: c9d1f5a8b670
Revises: b8c0e4f7a569
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c9d1f5a8b670"
down_revision: Union[str, None] = "b8c0e4f7a569"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "employee_employment_terms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("contract_type", sa.String(length=20), nullable=False, server_default="employment"),
        sa.Column("daily_minutes", sa.Integer(), nullable=False, server_default="480"),
        sa.UniqueConstraint("employee_id", "effective_from", name="uq_employee_employment_term_from"),
    )
    op.create_index(
        "ix_employee_employment_terms_employee_id",
        "employee_employment_terms",
        ["employee_id"],
    )

    # Migrate yearly work quotas → terms on Jan 1 of that year (UoP).
    op.execute(
        """
        INSERT INTO employee_employment_terms (id, employee_id, effective_from, contract_type, daily_minutes)
        SELECT gen_random_uuid(), employee_id, make_date(year, 1, 1), 'employment', daily_minutes
        FROM employee_work_quotas
        """
    )

    op.drop_index("ix_employee_work_quotas_employee_id", table_name="employee_work_quotas")
    op.drop_table("employee_work_quotas")


def downgrade() -> None:
    op.create_table(
        "employee_work_quotas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("daily_minutes", sa.Integer(), nullable=False, server_default="480"),
        sa.UniqueConstraint("employee_id", "year", name="uq_employee_work_quota_year"),
    )
    op.create_index(
        "ix_employee_work_quotas_employee_id",
        "employee_work_quotas",
        ["employee_id"],
    )
    op.execute(
        """
        INSERT INTO employee_work_quotas (id, employee_id, year, daily_minutes)
        SELECT gen_random_uuid(), employee_id, EXTRACT(YEAR FROM effective_from)::int, daily_minutes
        FROM employee_employment_terms
        ON CONFLICT DO NOTHING
        """
    )
    op.drop_index("ix_employee_employment_terms_employee_id", table_name="employee_employment_terms")
    op.drop_table("employee_employment_terms")
