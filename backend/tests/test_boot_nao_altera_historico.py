"""Regressão do ticket: subir a aplicação não pode tocar no histórico de estoque.

Antes, o import de ``app.main`` apagava as saídas de requisições não recebidas e
reescrevia ``current_stock`` de todos os produtos — a cada deploy e a cada worker
do uvicorn. O teste sobe o app num processo separado, com um banco preparado
com exatamente o cenário que era destruído, e confere que nada mudou.
"""

import os
import subprocess
import sys
import tempfile

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models
import app.models.price_table
import app.models.sale  # noqa: F401
from app.database import Base
from app.models.deposit import Deposit
from app.models.product import Product
from app.models.requisicao import Requisicao
from app.models.role import Role
from app.models.stock import StockMovement
from app.models.user import User

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

#: Saldo propositalmente incoerente com as movimentações. O boot antigo
#: "consertaria" isso sozinho; o novo tem de deixar quieto e esperar o comando.
SALDO_INCOERENTE = 123.0


@pytest.fixture()
def banco_de_boot():
    """Banco isolado com uma requisição não recebida e sua saída de estoque."""
    diretorio = tempfile.mkdtemp(prefix="gestao-boot-")
    caminho = os.path.join(diretorio, "boot.db")
    url = f"sqlite:///{caminho}"

    engine = create_engine(url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    with Session() as session:
        session.add(Role(name="admin", is_admin=True))
        usuario = User(
            name="Admin", email="admin@boot.com",
            hashed_password="x", role="admin", is_active=True,
        )
        deposito = Deposit(name="Central", is_active=True)
        loja = Deposit(name="Loja", is_active=True)
        produto = Product(name="Café 1kg", current_stock=SALDO_INCOERENTE)
        session.add_all([usuario, deposito, loja, produto])
        session.flush()

        requisicao = Requisicao(
            requester_id=usuario.id,
            deposit_requesting_id=loja.id,
            deposit_fulfilling_id=deposito.id,
            status="aprovado",  # nunca recebida — era o alvo da exclusão no boot
            reason="reposição",
        )
        session.add(requisicao)
        session.flush()

        session.add(StockMovement(
            product_id=produto.id,
            deposit_id=deposito.id,
            movement_type="saida",
            quantity=5,
            unit_price=1.0,
            total_value=5.0,
            reason=f"Requisição #{requisicao.id}: reposição",
            source="requisicao",
            user_id=usuario.id,
        ))
        session.commit()

    engine.dispose()
    return url, Session, create_engine(url, connect_args={"check_same_thread": False})


def _subir_app(url):
    """Importa ``app.main`` num processo limpo, como faz o uvicorn."""
    ambiente = {
        **os.environ,
        "DATABASE_URL": url,
        "SECRET_KEY": "chave-de-teste",
        "PYTHONPATH": BACKEND_DIR,
    }
    return subprocess.run(
        [sys.executable, "-c", "import app.main"],
        cwd=BACKEND_DIR, env=ambiente, capture_output=True, text=True, timeout=120,
    )


def test_boot_preserva_saida_de_requisicao_nao_recebida(banco_de_boot):
    url, Session, engine = banco_de_boot

    resultado = _subir_app(url)
    assert resultado.returncode == 0, f"o app não subiu:\n{resultado.stderr}"

    with Session() as session:
        movs = session.query(StockMovement).all()
        assert len(movs) == 1, "o boot apagou a movimentação de requisição"
        assert movs[0].movement_type == "saida"
        assert movs[0].quantity == 5


def test_boot_nao_reescreve_current_stock(banco_de_boot):
    url, Session, engine = banco_de_boot

    resultado = _subir_app(url)
    assert resultado.returncode == 0, f"o app não subiu:\n{resultado.stderr}"

    with Session() as session:
        produto = session.query(Product).filter(Product.name == "Café 1kg").first()
        assert produto.current_stock == SALDO_INCOERENTE, (
            "o boot recalculou o saldo por conta própria; isso agora é trabalho "
            "do comando de reparo"
        )


def test_boot_cria_a_coluna_de_compensacao(banco_de_boot):
    """O boot também não migra schema — quem cria a coluna é a migration.

    Este teste já afirmou o contrário: enquanto o DDL vivia em ``main.py``, subir
    o app criava a coluna que faltasse. Agora o schema só muda por
    ``alembic upgrade head`` (ver ``tests/test_migrations.py``), e o que o boot
    precisa garantir é justamente não mexer.
    """
    from sqlalchemy import inspect, text

    url, Session, engine = banco_de_boot
    # DROP COLUMN não serve: a coluna é FK para a própria tabela e o SQLite
    # recusa. Recriar a tabela sem ela reproduz o banco anterior à migration.
    colunas_antigas = (
        "id, product_id, deposit_id, movement_type, movement_date, quantity, "
        "unit_price, total_value, reason, notes, source, created_at, user_id"
    )
    with engine.begin() as conexao:
        conexao.execute(text(
            f"CREATE TABLE sm_pre_migracao AS SELECT {colunas_antigas} FROM stock_movements"
        ))
        conexao.execute(text("DROP TABLE stock_movements"))
        conexao.execute(text("ALTER TABLE sm_pre_migracao RENAME TO stock_movements"))

    resultado = _subir_app(url)
    assert resultado.returncode == 0, f"o app não subiu:\n{resultado.stderr}"

    inspect(engine).clear_cache()
    colunas = {c["name"] for c in inspect(engine).get_columns("stock_movements")}
    assert "compensates_movement_id" not in colunas, (
        "o boot voltou a aplicar DDL; criar coluna é trabalho da migration"
    )


def test_comando_de_reparo_conserta_o_que_o_boot_deixou(banco_de_boot):
    """O reparo continua disponível — só deixou de ser automático."""
    url, Session, engine = banco_de_boot
    ambiente = {
        **os.environ,
        "DATABASE_URL": url,
        "SECRET_KEY": "chave-de-teste",
        "PYTHONPATH": BACKEND_DIR,
    }

    simulacao = subprocess.run(
        [sys.executable, "-m", "app.cli.repair_stock"],
        cwd=BACKEND_DIR, env=ambiente, capture_output=True, text=True, timeout=120,
    )
    assert simulacao.returncode == 0, simulacao.stderr
    assert "SIMULAÇÃO" in simulacao.stdout
    with Session() as session:
        assert session.query(StockMovement).count() == 1, "a simulação gravou algo"

    aplicacao = subprocess.run(
        [sys.executable, "-m", "app.cli.repair_stock", "--apply"],
        cwd=BACKEND_DIR, env=ambiente, capture_output=True, text=True, timeout=120,
    )
    assert aplicacao.returncode == 0, aplicacao.stderr
    assert "APLICADO" in aplicacao.stdout

    with Session() as session:
        movs = session.query(StockMovement).order_by(StockMovement.id).all()
        assert len(movs) == 2, "faltou a compensação"
        assert movs[1].compensates_movement_id == movs[0].id
        assert movs[1].movement_type == "entrada"
        produto = session.query(Product).filter(Product.name == "Café 1kg").first()
        assert produto.current_stock == 0, "o saldo só se acerta pelo comando"
