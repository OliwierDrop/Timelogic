"""positions catalog and employee.position_id

Revision ID: c3d5f9a2b014
Revises: b2c4e8f1a903
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d5f9a2b014"
down_revision: Union[str, None] = "b2c4e8f1a903"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "positions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "id"),
        sa.UniqueConstraint("organization_id", "name"),
    )
    op.add_column("employees", sa.Column("position_id", sa.UUID(), nullable=True))
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            INSERT INTO positions (id, organization_id, name)
            SELECT gen_random_uuid(), organization_id, trim(position)
            FROM employees
            WHERE position IS NOT NULL AND trim(position) <> ''
            GROUP BY organization_id, trim(position)
            ON CONFLICT (organization_id, name) DO NOTHING
            """
        )
    )
    conn.execute(
        sa.text(
            """
            UPDATE employees e
            SET position_id = p.id,
                position = p.name
            FROM positions p
            WHERE e.organization_id = p.organization_id
              AND e.position IS NOT NULL
              AND trim(e.position) = p.name
            """
        )
    )
    op.create_foreign_key(
        "fk_employees_position",
        "employees",
        "positions",
        ["organization_id", "position_id"],
        ["organization_id", "id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_employees_position", "employees", type_="foreignkey")
    op.drop_column("employees", "position_id")
    op.drop_table("positions")
