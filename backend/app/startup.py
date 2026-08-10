"""Verificações de subida.

O app não cria mais schema. A contrapartida é que, quando o schema não está lá,
ele deve dizer isso — e não morrer com um "no such table" no meio de um seed.
"""

from sqlalchemy import inspect

#: Tabelas sem as quais o boot não passa dos seeds. Não é o schema inteiro:
#: é o suficiente para distinguir "banco não migrado" de "banco estranho".
TABELAS_ESSENCIAIS = ("users", "roles", "products", "stock_movements")


def verificar_schema(engine) -> None:
    """Falha cedo e explicando, se o banco não passou pelas migrations."""
    existentes = set(inspect(engine).get_table_names())
    faltando = [t for t in TABELAS_ESSENCIAIS if t not in existentes]
    if not faltando:
        return

    alvo = engine.url.render_as_string(hide_password=True)
    virgem = not (existentes - {"alembic_version"})
    receita = (
        "cd backend && alembic upgrade head"
        if virgem else
        "cd backend && alembic stamp 3f9bdb34aa4d && alembic upgrade head"
    )
    raise RuntimeError(
        f"Banco sem as tabelas {', '.join(faltando)} — o app não cria schema.\n"
        f"Alvo: {alvo}\n"
        f"Rode: {receita}\n"
        "Detalhes em backend/docs/migrations.md."
    )
