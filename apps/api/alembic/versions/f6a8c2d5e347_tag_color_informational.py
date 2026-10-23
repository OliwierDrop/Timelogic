"""tag color and informational flag

Revision ID: f6a8c2d5e347
Revises: e5f7b1c4d236
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6a8c2d5e347"
down_revision: Union[str, None] = "e5f7b1c4d236"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_COLOR = "#94A3B8"


def upgrade() -> None:
    op.add_column(
        "tags",
        sa.Column("color", sa.String(length=7), nullable=False, server_default=DEFAULT_COLOR),
    )
    op.add_column(
        "tags",
        sa.Column(
            "is_informational",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("tags", "is_informational")
    op.drop_column("tags", "color")
