"""Reconcilia as correções de schema que o boot aplicava sozinho

Revision ID: 7a1c4e9b2d18
Revises: 3f9bdb34aa4d
Create Date: 2026-08-10

Até esta série de migrations, ``app/main.py`` corrigia o schema no import: um
bloco de PRAGMA/ALTER para SQLite e outro de information_schema/ALTER para
Postgres, rodando a cada deploy e a cada worker do uvicorn.

A baseline (``3f9bdb34aa4d``) já descreve o schema como os models o definem
hoje, então num banco novo todas as colunas abaixo já existem e cada passo aqui
é no-op. Esta revisão existe para os bancos **antigos** — produção inclusive —
que são marcados na baseline com ``alembic stamp`` e nunca chegaram a executá-la:
sem ela, as colunas que o boot vinha acrescentando deixariam de existir para
sempre no dia em que o boot parasse de acrescentá-las.

Por isso cada passo é guardado por "existe?": a revisão precisa ser inócua no
banco novo e corretiva no banco velho, sem saber de antemão em qual está.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "7a1c4e9b2d18"
down_revision: Union[str, Sequence[str], None] = "3f9bdb34aa4d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _existing_columns(bind, table: str) -> dict:
    inspector = inspect(bind)
    if table not in inspector.get_table_names():
        return {}
    return {column["name"]: column for column in inspector.get_columns(table)}


def _add_column_if_missing(bind, table: str, column: sa.Column) -> bool:
    """Acrescenta a coluna só se faltar. Devolve se chegou a mexer."""
    existing = _existing_columns(bind, table)
    if not existing or column.name in existing:
        return False
    op.add_column(table, column)
    return True


def upgrade() -> None:
    bind = op.get_bind()

    # O SQLite recusa ADD COLUMN com default não-constante ("Cannot add a column
    # with non-constant default"), e CURRENT_TIMESTAMP é não-constante. O DDL do
    # boot tinha o mesmo defeito — nunca apareceu porque o ramo só rodaria num
    # banco a que ninguém mais chegava. Aqui a coluna entra sem default e as
    # linhas existentes são preenchidas em seguida.
    if bind.dialect.name == "sqlite":
        if _add_column_if_missing(bind, "stock_movements", sa.Column("movement_date", sa.DateTime())):
            op.execute(
                "UPDATE stock_movements SET movement_date = CURRENT_TIMESTAMP "
                "WHERE movement_date IS NULL"
            )
    else:
        _add_column_if_missing(
            bind, "stock_movements",
            sa.Column("movement_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        )

    _add_column_if_missing(bind, "products", sa.Column("markup", sa.Float()))

    for nome, tipo in (
        ("flag", sa.String(50)),
        ("closing_day", sa.Integer()),
        ("due_day", sa.Integer()),
        ("best_purchase_day", sa.Integer()),
        ("credit_limit", sa.Float()),
    ):
        _add_column_if_missing(bind, "accounts", sa.Column(nome, tipo))

    # O SQLite não aceita ALTER TABLE ADD COLUMN com chave estrangeira (o Alembic
    # pediria batch mode, que recria a tabela). A restrição fica só onde dá para
    # criá-la — era o que os dois blocos do boot já faziam, cada um do seu jeito.
    if bind.dialect.name == "sqlite":
        _add_column_if_missing(bind, "contacts", sa.Column("price_table_id", sa.Integer()))
    else:
        _add_column_if_missing(
            bind, "contacts",
            sa.Column("price_table_id", sa.Integer(), sa.ForeignKey("price_tables.id")),
        )
    _add_column_if_missing(bind, "contacts", sa.Column("segment", sa.String(50)))
    _add_column_if_missing(bind, "contacts", sa.Column("cep", sa.String(10)))

    _add_column_if_missing(bind, "transactions", sa.Column("recurrence_frequency", sa.String(20)))
    _add_column_if_missing(bind, "transactions", sa.Column("due_date", sa.DateTime()))
    _add_column_if_missing(
        bind, "transactions",
        sa.Column("status", sa.String(20), server_default="pendente"),
    )

    _add_column_if_missing(
        bind, "requisicao_items",
        sa.Column("quantity_fulfilled", sa.Float(), server_default="0"),
    )
    _add_column_if_missing(
        bind, "requisicao_items",
        sa.Column("quantity_received", sa.Float(), server_default="0"),
    )

    _add_column_if_missing(bind, "stock_movements", sa.Column("source", sa.String(20)))

    # Backfill que acompanhava a criação de `source` no boot. Sem ele, as
    # movimentações antigas de requisição ficam sem origem — e é por `source`
    # que o sistema recusa editar/estornar movimentação gerada por requisição.
    # Restrito a source IS NULL para ser idempotente e não pisar em classificação
    # já feita.
    if "stock_movements" in inspect(bind).get_table_names():
        op.execute(
            "UPDATE stock_movements SET source = 'requisicao' "
            "WHERE source IS NULL AND ("
            "reason LIKE 'Requisição #%' OR reason LIKE 'Recebimento Requisição #%')"
        )

    # Quantidades viraram fracionárias em algum momento; no Postgres antigo elas
    # ficaram INTEGER e truncariam meia unidade silenciosamente.
    if bind.dialect.name == "postgresql":
        for tabela, colunas in {
            "stock_movements": ("quantity",),
            "requisicao_items": (
                "quantity_requested", "quantity_approved",
                "quantity_fulfilled", "quantity_received",
            ),
            "products": ("current_stock", "min_stock"),
        }.items():
            existentes = _existing_columns(bind, tabela)
            for nome in colunas:
                coluna = existentes.get(nome)
                if coluna and isinstance(coluna["type"], sa.Integer):
                    op.alter_column(
                        tabela, nome,
                        existing_type=coluna["type"],
                        type_=sa.Float(),
                        postgresql_using=f"{nome}::double precision",
                    )


def downgrade() -> None:
    # Reconciliação não tem volta: desfazer significaria remover colunas que a
    # baseline cria, deixando o banco atrás do próprio ponto de partida.
    raise NotImplementedError("Revisão de reconciliação não é reversível.")
