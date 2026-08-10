"""O schema só muda por migration — e a cadeia tem de servir banco novo e velho.

Os testes rodam o `alembic` em subprocesso, do mesmo jeito que o deploy roda
(`start.sh` / `render.yaml`), em vez de chamar a API interna: o que precisa
funcionar é o comando, não a biblioteca.
"""

import ast
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

import app.models  # noqa: F401
from app.database import Base

BACKEND_DIR = Path(__file__).resolve().parents[1]
MAIN_PY = BACKEND_DIR / "app" / "main.py"
BASELINE = "3f9bdb34aa4d"

#: Colunas que os blocos de ALTER do boot acrescentavam em bancos antigos.
#: São exatamente as que a revisão de reconciliação precisa repor.
COLUNAS_DO_BOOT = {
    "stock_movements": ["source", "movement_date"],
    "contacts": ["price_table_id", "segment", "cep"],
    "requisicao_items": ["quantity_fulfilled", "quantity_received"],
    "transactions": ["recurrence_frequency", "due_date", "status"],
    "accounts": ["flag", "closing_day", "due_day", "best_purchase_day", "credit_limit"],
    "products": ["markup"],
}


def _alembic(url, *args):
    ambiente = {
        **os.environ,
        "DATABASE_URL": url,
        "SECRET_KEY": "chave-de-teste",
        "PYTHONPATH": str(BACKEND_DIR),
    }
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR, env=ambiente, capture_output=True, text=True, timeout=180,
    )


@pytest.fixture()
def url_temporaria():
    diretorio = tempfile.mkdtemp(prefix="gestao-mig-")
    yield f"sqlite:///{diretorio}/mig.db"


def _colunas(engine, tabela):
    return {c["name"] for c in inspect(engine).get_columns(tabela)}


# --------------------------------------------------------------------------
# A cadeia
# --------------------------------------------------------------------------

def test_existe_uma_unica_head():
    """Duas raízes independentes fariam `upgrade head` recusar a subir.

    Foi exatamente o que aconteceu quando duas frentes escreveram baselines em
    paralelo, cada uma com down_revision=None.
    """
    resultado = _alembic("sqlite:///:memory:", "heads")

    assert resultado.returncode == 0, resultado.stderr
    heads = [linha for linha in resultado.stdout.splitlines() if linha.strip()]
    assert len(heads) == 1, f"esperava uma head, veio: {heads}"


def test_a_baseline_e_a_unica_raiz():
    resultado = _alembic("sqlite:///:memory:", "history")

    assert resultado.returncode == 0, resultado.stderr
    raizes = [l for l in resultado.stdout.splitlines() if l.startswith("<base>")]
    assert len(raizes) == 1, f"esperava uma raiz, veio: {raizes}"
    assert BASELINE in raizes[0]


# --------------------------------------------------------------------------
# Banco novo
# --------------------------------------------------------------------------

def test_banco_novo_sobe_ate_o_schema_dos_models(url_temporaria):
    resultado = _alembic(url_temporaria, "upgrade", "head")
    assert resultado.returncode == 0, resultado.stderr

    engine = create_engine(url_temporaria)
    tabelas = set(inspect(engine).get_table_names()) - {"alembic_version"}
    assert tabelas == set(Base.metadata.tables), "schema migrado difere dos models"

    for tabela in sorted(tabelas):
        esperadas = set(Base.metadata.tables[tabela].columns.keys())
        assert esperadas <= _colunas(engine, tabela), f"faltam colunas em {tabela}"


def test_banco_novo_recebe_compensates_movement_id(url_temporaria):
    """Coluna do histórico imutável: a baseline é anterior a ela."""
    assert _alembic(url_temporaria, "upgrade", "head").returncode == 0

    engine = create_engine(url_temporaria)
    assert "compensates_movement_id" in _colunas(engine, "stock_movements")


def test_upgrade_e_idempotente(url_temporaria):
    assert _alembic(url_temporaria, "upgrade", "head").returncode == 0
    segundo = _alembic(url_temporaria, "upgrade", "head")
    assert segundo.returncode == 0, segundo.stderr


# --------------------------------------------------------------------------
# Banco antigo (o caso de produção)
# --------------------------------------------------------------------------

@pytest.fixture()
def banco_legado(url_temporaria):
    """Reproduz um banco anterior às migrations: schema sem as colunas do boot.

    As tabelas são recriadas por CREATE TABLE AS SELECT porque o SQLite recusa
    DROP COLUMN em coluna referenciada por chave estrangeira.
    """
    engine = create_engine(url_temporaria)
    Base.metadata.create_all(bind=engine)

    with engine.begin() as conexao:
        for tabela, removidas in COLUNAS_DO_BOOT.items():
            mantidas = [
                c for c in Base.metadata.tables[tabela].columns.keys()
                if c not in removidas and c != "compensates_movement_id"
            ]
            lista = ", ".join(mantidas)
            conexao.execute(text(f"CREATE TABLE _legado AS SELECT {lista} FROM {tabela}"))
            conexao.execute(text(f"DROP TABLE {tabela}"))
            conexao.execute(text(f"ALTER TABLE _legado RENAME TO {tabela}"))

        # Movimentação antiga de requisição, gravada antes de existir `source`.
        conexao.execute(text(
            "INSERT INTO stock_movements (product_id, deposit_id, movement_type, "
            "quantity, unit_price, total_value, reason) "
            "VALUES (1, 1, 'saida', 5, 1.0, 5.0, 'Requisição #1: reposição')"
        ))
    engine.dispose()
    return url_temporaria


def test_banco_legado_e_adotado_por_stamp_e_reconciliado(banco_legado):
    """O caminho de produção: stamp na baseline, depois upgrade."""
    engine = create_engine(banco_legado)
    assert "source" not in _colunas(engine, "stock_movements"), "fixture não removeu a coluna"

    stamp = _alembic(banco_legado, "stamp", BASELINE)
    assert stamp.returncode == 0, stamp.stderr

    upgrade = _alembic(banco_legado, "upgrade", "head")
    assert upgrade.returncode == 0, upgrade.stderr

    engine = create_engine(banco_legado)
    for tabela, colunas in COLUNAS_DO_BOOT.items():
        presentes = _colunas(engine, tabela)
        faltando = [c for c in colunas if c not in presentes]
        assert not faltando, f"reconciliação não repôs {faltando} em {tabela}"
    assert "compensates_movement_id" in _colunas(engine, "stock_movements")


def test_reconciliacao_reclassifica_movimentacao_antiga(banco_legado):
    """`source` é o que impede editar/estornar movimentação de requisição.

    Sem o backfill, a movimentação legada ficaria editável.
    """
    assert _alembic(banco_legado, "stamp", BASELINE).returncode == 0
    assert _alembic(banco_legado, "upgrade", "head").returncode == 0

    engine = create_engine(banco_legado)
    with engine.connect() as conexao:
        origens = conexao.execute(text(
            "SELECT source FROM stock_movements WHERE reason LIKE 'Requisição #%'"
        )).fetchall()
    assert origens, "a movimentação legada sumiu"
    assert all(linha[0] == "requisicao" for linha in origens)


def test_ensaio_do_corte_de_producao(banco_legado):
    """O procedimento inteiro do banco que já existia: stamp, upgrade, subir.

    É o que vai ser feito no Neon. Se este teste passa, o corte tem ensaio.
    """
    assert _alembic(banco_legado, "stamp", BASELINE).returncode == 0
    assert _alembic(banco_legado, "upgrade", "head").returncode == 0

    resultado = _subir_app(banco_legado)

    assert resultado.returncode == 0, (
        f"o app não subiu depois do corte:\n{resultado.stderr}"
    )


def test_stamp_nao_recria_tabela_existente(banco_legado):
    """Rodar a baseline num banco que já tem as tabelas falharia — por isso stamp."""
    sem_stamp = _alembic(banco_legado, "upgrade", "head")

    assert sem_stamp.returncode != 0
    assert "already exists" in (sem_stamp.stderr + sem_stamp.stdout).lower()


# --------------------------------------------------------------------------
# O boot
# --------------------------------------------------------------------------

def _chamadas(arvore):
    for no in ast.walk(arvore):
        if isinstance(no, ast.Call):
            yield no


def test_main_nao_executa_ddl_no_import():
    """Checagem na árvore sintática, não no texto: comentário não é código."""
    arvore = ast.parse(MAIN_PY.read_text(encoding="utf-8"))

    for chamada in _chamadas(arvore):
        nome = getattr(chamada.func, "attr", None)
        assert nome != "create_all", "main.py voltou a criar schema no import"

    ddl = ("ALTER TABLE", "CREATE TABLE", "DROP TABLE", "CREATE INDEX", "PRAGMA table_info")
    for no in ast.walk(arvore):
        if isinstance(no, ast.Constant) and isinstance(no.value, str):
            encontrado = [t for t in ddl if t in no.value.upper()]
            assert not encontrado, f"DDL literal em main.py: {encontrado}"


def test_main_nao_importa_o_Base():
    """Sem metadata no boot não há como recriar o atalho do create_all."""
    arvore = ast.parse(MAIN_PY.read_text(encoding="utf-8"))
    importados = {
        alias.name
        for no in ast.walk(arvore) if isinstance(no, ast.ImportFrom)
        for alias in no.names
    }
    assert "Base" not in importados


def _subir_app(url):
    ambiente = {
        **os.environ,
        "DATABASE_URL": url,
        "SECRET_KEY": "chave-de-teste",
        "PYTHONPATH": str(BACKEND_DIR),
    }
    return subprocess.run(
        [sys.executable, "-c", "import app.main"],
        cwd=BACKEND_DIR, env=ambiente, capture_output=True, text=True, timeout=120,
    )


def test_boot_nao_cria_schema_em_banco_vazio(url_temporaria):
    """Subir o app contra um banco não migrado não pode "consertar" sozinho."""
    _subir_app(url_temporaria)

    engine = create_engine(url_temporaria)
    tabelas = set(inspect(engine).get_table_names()) - {"alembic_version"}
    assert tabelas == set(), f"o boot criou schema por conta própria: {sorted(tabelas)}"


def test_boot_em_banco_nao_migrado_explica_o_que_fazer(url_temporaria):
    """Sem poder consertar, o boot deve ao menos dizer por que parou.

    O sintoma antes era um "no such table: roles" no meio de um seed.
    """
    resultado = _subir_app(url_temporaria)

    assert resultado.returncode != 0
    saida = resultado.stderr + resultado.stdout
    assert "o app não cria schema" in saida
    assert "alembic upgrade head" in saida


def test_boot_funciona_depois_das_migrations(url_temporaria):
    assert _alembic(url_temporaria, "upgrade", "head").returncode == 0

    resultado = _subir_app(url_temporaria)

    assert resultado.returncode == 0, f"o app não subiu migrado:\n{resultado.stderr}"
