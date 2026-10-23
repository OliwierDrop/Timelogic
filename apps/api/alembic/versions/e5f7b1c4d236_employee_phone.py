"""employee phone

Revision ID: e5f7b1c4d236
Revises: d4e6a0b3c125
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5f7b1c4d236"
down_revision: Union[str, None] = "d4e6a0b3c125"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("employees", sa.Column("phone", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("employees", "phone")
