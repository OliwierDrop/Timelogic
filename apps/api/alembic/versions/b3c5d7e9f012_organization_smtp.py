"""organization smtp settings

Revision ID: b3c5d7e9f012
Revises: a1b2c3d4e5f6
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3c5d7e9f012"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("smtp_host", sa.String(255), nullable=True))
    op.add_column("organizations", sa.Column("smtp_port", sa.Integer(), nullable=True))
    op.add_column("organizations", sa.Column("smtp_from", sa.String(320), nullable=True))
    op.add_column(
        "organizations",
        sa.Column("smtp_starttls", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("organizations", sa.Column("smtp_user", sa.String(320), nullable=True))
    op.add_column("organizations", sa.Column("smtp_password_enc", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "smtp_password_enc")
    op.drop_column("organizations", "smtp_user")
    op.drop_column("organizations", "smtp_starttls")
    op.drop_column("organizations", "smtp_from")
    op.drop_column("organizations", "smtp_port")
    op.drop_column("organizations", "smtp_host")
