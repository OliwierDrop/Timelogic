"""user pending_email for email change confirmation

Revision ID: d0e2a6b9c781
Revises: c9d1f5a8b670
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d0e2a6b9c781"
down_revision: Union[str, None] = "c9d1f5a8b670"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("pending_email", sa.String(length=320), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "pending_email")
