"""Adiciona stock_movements.compensates_movement_id

Revision ID: 9e3f6a2c5b74
Revises: 7a1c4e9b2d18
Create Date: 2026-08-10

Coluna do histórico imutável de estoque: liga um estorno à movimentação que ele
anula (ver ``backend/docs/estoque-historico-imutavel.md``). Chegou junto com
aquele trabalho, que a criava por DDL no boot; como o boot deixou de aplicar
DDL, ela passa a ser criada aqui — do contrário nunca existiria.

A baseline ``3f9bdb34aa4d`` foi gerada antes dessa coluna, então num banco novo
ela realmente falta neste ponto da cadeia.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "9e3f6a2c5b74"
down_revision: Union[str, Sequence[str], None] = "7a1c4e9b2d18"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABELA = "stock_movements"
COLUNA = "compensates_movement_id"


def _tem_coluna(bind) -> bool:
    inspector = inspect(bind)
    if TABELA not in inspector.get_table_names():
        return False
    return COLUNA in {c["name"] for c in inspector.get_columns(TABELA)}


def upgrade() -> None:
    bind = op.get_bind()
    # Guardado porque ambientes que chegaram a subir a versão anterior já
    # receberam a coluna pelo DDL do boot.
    if _tem_coluna(bind):
        return
    op.add_column(TABELA, sa.Column(COLUNA, sa.Integer(), nullable=True))
    # SQLite não cria FK em ALTER TABLE; a restrição fica só onde dá para criá-la.
    if bind.dialect.name != "sqlite":
        op.create_foreign_key(
            "fk_stock_movements_compensates", TABELA, TABELA, [COLUNA], ["id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    if not _tem_coluna(bind):
        return
    if bind.dialect.name != "sqlite":
        op.drop_constraint("fk_stock_movements_compensates", TABELA, type_="foreignkey")
    op.drop_column(TABELA, COLUNA)
