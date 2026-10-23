"""leave types category and balance limit flags

Revision ID: b8c0e4f7a569
Revises: a7b9d3e6f458
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8c0e4f7a569"
down_revision: Union[str, None] = "a7b9d3e6f458"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "leave_types",
        sa.Column("category", sa.String(length=20), nullable=False, server_default="leave"),
    )
    op.add_column(
        "leave_types",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "leave_types",
        sa.Column("allows_carry_over", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "leave_balances",
        sa.Column("unlimited", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "leave_balances",
        sa.Column("carry_over", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "leave_balances",
        sa.Column("period", sa.String(length=10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("leave_balances", "period")
    op.drop_column("leave_balances", "carry_over")
    op.drop_column("leave_balances", "unlimited")
    op.drop_column("leave_types", "allows_carry_over")
    op.drop_column("leave_types", "sort_order")
    op.drop_column("leave_types", "category")
