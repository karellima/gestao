"""DELETE e PUT em /api/stock/movements continuam existindo — mas por compensação."""

from app.models.stock import StockMovement
from app.services.stock_ledger import SOURCE_ESTORNO


def _movimentacoes(db):
    return db.query(StockMovement).order_by(StockMovement.id).all()


def test_delete_estorna_em_vez_de_apagar(client, db, nova_movimentacao, produto):
    original = nova_movimentacao(movement_type="entrada", quantity=10, unit_price=5.0)

    resposta = client.delete(f"/api/stock/movements/{original.id}")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["message"] == "Movimentação estornada"
    assert corpo["movement_id"] == original.id

    movs = _movimentacoes(db)
    assert len(movs) == 2, "a original tem de continuar no histórico"
    assert movs[0].id == original.id
    assert movs[1].id == corpo["compensation_id"]
    assert movs[1].movement_type == "saida"
    assert movs[1].quantity == 10
    assert movs[1].compensates_movement_id == original.id
    assert movs[1].source == SOURCE_ESTORNO

    db.refresh(produto)
    assert produto.current_stock == 0


def test_delete_de_movimentacao_de_requisicao_continua_recusado(client, db, nova_movimentacao):
    mov = nova_movimentacao(source="requisicao", reason="Requisição #1: teste")

    resposta = client.delete(f"/api/stock/movements/{mov.id}")

    assert resposta.status_code == 400
    assert "requisição" in resposta.json()["detail"].lower()
    assert len(_movimentacoes(db)) == 1


def test_delete_duas_vezes_recusa_a_segunda(client, db, nova_movimentacao):
    mov = nova_movimentacao()

    assert client.delete(f"/api/stock/movements/{mov.id}").status_code == 200
    segunda = client.delete(f"/api/stock/movements/{mov.id}")

    assert segunda.status_code == 400
    assert "estornada" in segunda.json()["detail"]
    assert len(_movimentacoes(db)) == 2, "nenhum estorno duplicado"


def test_delete_de_um_estorno_e_recusado(client, db, nova_movimentacao):
    mov = nova_movimentacao()
    estorno_id = client.delete(f"/api/stock/movements/{mov.id}").json()["compensation_id"]

    resposta = client.delete(f"/api/stock/movements/{estorno_id}")

    assert resposta.status_code == 400
    assert "Estorno" in resposta.json()["detail"]


def test_delete_de_movimentacao_inexistente(client):
    assert client.delete("/api/stock/movements/9999").status_code == 404


def test_put_gera_estorno_mais_lancamento_corrigido(client, db, nova_movimentacao, produto):
    original = nova_movimentacao(movement_type="entrada", quantity=10, unit_price=5.0)

    resposta = client.put(
        f"/api/stock/movements/{original.id}",
        json={"quantity": 7, "reason": "quantidade conferida"},
    )

    assert resposta.status_code == 200
    corrigida = resposta.json()
    assert corrigida["quantity"] == 7
    assert corrigida["id"] != original.id, "correção é lançamento novo, não sobrescrita"

    movs = _movimentacoes(db)
    assert len(movs) == 3, "original + estorno + corrigida"
    assert movs[0].id == original.id
    assert movs[0].quantity == 10, "a original não pode ter sido alterada"
    assert movs[1].compensates_movement_id == original.id
    assert movs[1].movement_type == "saida"
    assert movs[2].quantity == 7
    assert movs[2].movement_type == "entrada"
    assert movs[2].compensates_movement_id is None

    db.refresh(produto)
    assert produto.current_stock == 7


def test_put_recalcula_total_value(client, db, nova_movimentacao):
    original = nova_movimentacao(movement_type="entrada", quantity=10, unit_price=5.0)

    resposta = client.put(
        f"/api/stock/movements/{original.id}",
        json={"quantity": 3, "unit_price": 2.0},
    )

    assert resposta.json()["total_value"] == 6.0


def test_put_mantem_campos_nao_enviados(client, db, nova_movimentacao):
    original = nova_movimentacao(
        movement_type="entrada", quantity=10, unit_price=5.0,
        reason="compra inicial", notes="nota original",
    )

    corrigida = client.put(
        f"/api/stock/movements/{original.id}", json={"quantity": 8},
    ).json()

    assert corrigida["reason"] == "compra inicial"
    assert corrigida["notes"] == "nota original"
    assert corrigida["unit_price"] == 5.0
    assert corrigida["movement_type"] == "entrada"


def test_put_trocando_de_produto_acerta_os_dois_saldos(client, db, nova_movimentacao, produto):
    from app.models.product import Product

    outro = db.query(Product).filter(Product.name == "Açúcar 1kg").first()
    original = nova_movimentacao(movement_type="entrada", quantity=10)

    resposta = client.put(
        f"/api/stock/movements/{original.id}",
        json={"product_id": outro.id},
    )

    assert resposta.status_code == 200
    db.refresh(produto)
    db.refresh(outro)
    assert produto.current_stock == 0, "estorno devolveu o saldo do produto errado"
    assert outro.current_stock == 10


def test_put_de_movimentacao_de_requisicao_continua_recusado(client, db, nova_movimentacao):
    mov = nova_movimentacao(source="requisicao", reason="Requisição #1: teste")

    resposta = client.put(f"/api/stock/movements/{mov.id}", json={"quantity": 3})

    assert resposta.status_code == 400
    assert len(_movimentacoes(db)) == 1


def test_put_com_produto_inexistente_nao_grava_nada(client, db, nova_movimentacao):
    original = nova_movimentacao()

    resposta = client.put(
        f"/api/stock/movements/{original.id}", json={"product_id": 9999},
    )

    assert resposta.status_code == 404
    assert len(_movimentacoes(db)) == 1, "nada de estorno órfão quando a validação falha"


def test_put_em_movimentacao_ja_estornada_e_recusado(client, db, nova_movimentacao):
    mov = nova_movimentacao()
    client.delete(f"/api/stock/movements/{mov.id}")

    resposta = client.put(f"/api/stock/movements/{mov.id}", json={"quantity": 2})

    assert resposta.status_code == 400
    assert len(_movimentacoes(db)) == 2


def test_movimentacoes_continuam_listaveis_apos_estorno(client, db, nova_movimentacao):
    mov = nova_movimentacao()
    client.delete(f"/api/stock/movements/{mov.id}")

    listagem = client.get("/api/stock/movements/").json()

    assert len(listagem) == 2
    ids = {m["id"] for m in listagem}
    assert mov.id in ids, "a movimentação estornada continua visível no extrato"


def test_extrato_identifica_o_par_lancamento_estorno(client, db, nova_movimentacao):
    """O cliente precisa conseguir ligar o estorno ao lançamento que ele anula."""
    mov = nova_movimentacao()
    estorno_id = client.delete(f"/api/stock/movements/{mov.id}").json()["compensation_id"]

    por_id = {m["id"]: m for m in client.get("/api/stock/movements/").json()}

    assert por_id[mov.id]["compensates_movement_id"] is None
    assert por_id[estorno_id]["compensates_movement_id"] == mov.id
    assert por_id[estorno_id]["source"] == SOURCE_ESTORNO
