"""user 2fa fields and preferences

Revision ID: a1b2c3d4e5f6
Revises: f2a4c6e8b901
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f2a4c6e8b901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("totp_enabled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("email_otp_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("time_format", sa.String(8), nullable=False, server_default="h24"),
        sa.Column("date_format", sa.String(8), nullable=False, server_default="dmy"),
        sa.Column("week_starts_on", sa.String(16), nullable=False, server_default="monday"),
        sa.Column("theme", sa.String(16), nullable=False, server_default="system"),
        sa.CheckConstraint("time_format IN ('h24', 'h12')", name="user_pref_time_format"),
        sa.CheckConstraint("date_format IN ('dmy', 'ymd', 'mdy')", name="user_pref_date_format"),
        sa.CheckConstraint("week_starts_on IN ('monday', 'sunday')", name="user_pref_week_starts"),
        sa.CheckConstraint("theme IN ('system', 'light', 'dark')", name="user_pref_theme"),
    )


def downgrade() -> None:
    op.drop_table("user_preferences")
    op.drop_column("users", "email_otp_enabled")
    op.drop_column("users", "totp_enabled_at")
    op.drop_column("users", "totp_secret")
