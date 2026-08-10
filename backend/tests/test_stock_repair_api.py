"""POST /api/stock/repair — o reparo sob demanda, restrito a admin."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.models.role import Role
from app.models.stock import StockMovement
from app.models.user import User
from app.routers import stock as stock_router
from app.utils.security import get_current_user


@pytest.fixture()
def cliente_operador(db):
    """Cliente autenticado como um perfil não-admin."""
    db.add(Role(name="operador", is_admin=False))
    operador = User(
        name="Operador", email="op@teste.com",
        hashed_password="x", role="operador", is_active=True,
    )
    db.add(operador)
    db.commit()

    api = FastAPI()
    api.include_router(stock_router.router)
    api.dependency_overrides[get_db] = lambda: db
    api.dependency_overrides[get_current_user] = lambda: operador
    with TestClient(api) as test_client:
        yield test_client


def test_reparo_simula_por_padrao(client, db, nova_movimentacao, produto):
    nova_movimentacao(movement_type="entrada", quantity=10)
    produto.current_stock = 2
    db.commit()

    relatorio = client.post("/api/stock/repair", json={}).json()

    assert relatorio["dry_run"] is True
    divergencia = next(d for d in relatorio["stock_divergences"] if d["product_id"] == produto.id)
    assert divergencia["current_stock"] == 2
    assert divergencia["derived_stock"] == 10
    db.refresh(produto)
    assert produto.current_stock == 2, "o padrão do endpoint não pode gravar"


def test_reparo_sem_corpo_tambem_simula(client, db, nova_movimentacao, produto):
    nova_movimentacao(movement_type="entrada", quantity=10)
    produto.current_stock = 2
    db.commit()

    resposta = client.post("/api/stock/repair")

    assert resposta.status_code == 200
    assert resposta.json()["dry_run"] is True


def test_reparo_aplica_quando_pedido(client, db, nova_movimentacao, produto, admin):
    nova_movimentacao(movement_type="entrada", quantity=10)
    produto.current_stock = 2
    db.commit()

    relatorio = client.post("/api/stock/repair", json={"dry_run": False}).json()

    assert relatorio["dry_run"] is False
    assert relatorio["executed_by_user_id"] == admin.id
    ressincronizado = next(
        r for r in relatorio["products_resynced"] if r["product_id"] == produto.id
    )
    assert ressincronizado["from"] == 2
    assert ressincronizado["to"] == 10
    db.refresh(produto)
    assert produto.current_stock == 10


def test_reparo_nao_apaga_movimentacao(client, db, nova_movimentacao):
    nova_movimentacao(movement_type="entrada", quantity=10)
    nova_movimentacao(movement_type="saida", quantity=4)
    ids_antes = {m.id for m in db.query(StockMovement).all()}

    client.post("/api/stock/repair", json={"dry_run": False})

    ids_depois = {m.id for m in db.query(StockMovement).all()}
    assert ids_antes <= ids_depois


def test_reparo_e_restrito_a_admin(cliente_operador, db, nova_movimentacao, produto):
    nova_movimentacao(movement_type="entrada", quantity=10)
    produto.current_stock = 2
    db.commit()

    resposta = cliente_operador.post("/api/stock/repair", json={"dry_run": False})

    assert resposta.status_code == 403
    db.refresh(produto)
    assert produto.current_stock == 2


def test_relatorio_traz_as_quatro_secoes(client, db, nova_movimentacao):
    nova_movimentacao(movement_type="entrada", quantity=10)

    relatorio = client.post("/api/stock/repair", json={}).json()

    for chave in (
        "orphan_requisicao_exits", "stock_divergences",
        "compensations_created", "products_resynced",
    ):
        assert chave in relatorio, f"faltou {chave} no relatório"
    assert "executed_at" in relatorio
