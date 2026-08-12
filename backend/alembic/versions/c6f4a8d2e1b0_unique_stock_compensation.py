"""Garante uma única compensação por movimentação de estoque.

Revision ID: c6f4a8d2e1b0
Revises: 9e3f6a2c5b74
Create Date: 2026-08-12
"""

from collections.abc import Sequence

from sqlalchemy import inspect, text

from alembic import op

revision: str = "c6f4a8d2e1b0"
down_revision: str | Sequence[str] | None = "9e3f6a2c5b74"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "stock_movements"
INDEX = "uq_stock_movements_compensates_movement_id"


def _has_index(bind) -> bool:
    return INDEX in {index["name"] for index in inspect(bind).get_indexes(TABLE)}


def upgrade() -> None:
    bind = op.get_bind()
    duplicate = bind.execute(text(
        "SELECT compensates_movement_id FROM stock_movements "
        "WHERE compensates_movement_id IS NOT NULL "
        "GROUP BY compensates_movement_id HAVING COUNT(*) > 1 LIMIT 1"
    )).first()
    if duplicate is not None:
        raise RuntimeError(
            "Há movimentação com mais de uma compensação; corrija o ledger antes do upgrade"
        )
    if not _has_index(bind):
        op.create_index(INDEX, TABLE, ["compensates_movement_id"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    if _has_index(bind):
        op.drop_index(INDEX, table_name=TABLE)
