"""token_version para revogacao de sessao

Revision ID: d4b7e91f3a26
Revises: c6f4a8d2e1b0
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d4b7e91f3a26"
down_revision: str | Sequence[str] | None = "c6f4a8d2e1b0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Acrescenta a geração da credencial, com 1 para quem já existe.

    O `server_default` não é enfeite: a coluna nasce `NOT NULL` e a tabela já
    tem linhas. Sem ele o banco recusa a migration em produção, e no dia em que
    aceitasse os usuários existentes ficariam com `NULL` — que nunca casa com a
    versão do token e trancaria todo mundo para fora, sem mensagem que explique.
    """
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
