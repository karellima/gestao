"""O histórico de estoque é imutável: nada some, correção é compensação."""

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.product import Product
from app.models.stock import StockMovement
from app.services.stock_ledger import (
    SOURCE_ESTORNO,
    compensate_movement,
    derived_stock,
    is_compensated,
    recalculate_product_stock,
)


def test_compensacao_zera_o_saldo_e_preserva_as_duas_linhas(db, nova_movimentacao, produto, admin):
    original = nova_movimentacao(movement_type="entrada", quantity=10)
    recalculate_product_stock(db, produto.id)
    assert produto.current_stock == 10

    compensacao = compensate_movement(db, original, user_id=admin.id)
    db.commit()
    recalculate_product_stock(db, produto.id)

    assert compensacao.movement_type == "saida"
    assert compensacao.quantity == 10
    assert compensacao.compensates_movement_id == original.id
    assert compensacao.source == SOURCE_ESTORNO
    assert produto.current_stock == 0
    # As duas linhas continuam no histórico — é esse o ponto.
    assert db.query(StockMovement).count() == 2
    assert db.query(StockMovement).filter(StockMovement.id == original.id).first() is not None


def test_compensacao_de_saida_devolve_ao_estoque(db, nova_movimentacao, produto, admin):
    nova_movimentacao(movement_type="entrada", quantity=10)
    saida = nova_movimentacao(movement_type="saida", quantity=4)
    recalculate_product_stock(db, produto.id)
    assert produto.current_stock == 6

    compensate_movement(db, saida, user_id=admin.id)
    db.commit()
    recalculate_product_stock(db, produto.id)

    assert produto.current_stock == 10


def test_is_compensated_enxerga_o_estorno(db, nova_movimentacao, admin):
    mov = nova_movimentacao()
    assert is_compensated(db, mov.id) is False

    compensate_movement(db, mov, user_id=admin.id)
    db.commit()

    assert is_compensated(db, mov.id) is True


def test_banco_recusa_duas_compensacoes_da_mesma_movimentacao(
    db, nova_movimentacao, admin,
):
    mov = nova_movimentacao()
    compensate_movement(db, mov, user_id=admin.id)
    db.commit()

    with pytest.raises(IntegrityError):
        compensate_movement(db, mov, user_id=admin.id)
        db.commit()


def test_derived_stock_filtra_por_deposito(db, nova_movimentacao, produto, deposito):
    outro = 2  # "Loja 1"
    nova_movimentacao(movement_type="entrada", quantity=10, deposit_id=deposito.id)
    nova_movimentacao(movement_type="entrada", quantity=3, deposit_id=outro)

    assert derived_stock(db, produto.id) == 13
    assert derived_stock(db, produto.id, deposit_id=deposito.id) == 10
    assert derived_stock(db, produto.id, deposit_id=outro) == 3


def test_recalculate_nao_toca_no_historico(db, nova_movimentacao, produto):
    nova_movimentacao(movement_type="entrada", quantity=7)
    antes = db.query(StockMovement).count()

    produto.current_stock = 999  # cache corrompido
    db.commit()
    recalculate_product_stock(db, produto.id)

    assert produto.current_stock == 7
    assert db.query(StockMovement).count() == antes


def test_recalculate_de_produto_inexistente_nao_explode(db):
    assert recalculate_product_stock(db, 99999) is None


def test_compensacao_e_datada_de_agora(db, nova_movimentacao, admin):
    from datetime import UTC, datetime, timedelta

    antiga = nova_movimentacao(movement_type="entrada", quantity=5)
    antiga.movement_date = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=30)
    db.commit()

    compensacao = compensate_movement(db, antiga, user_id=admin.id)
    db.commit()
    db.refresh(compensacao)

    # O estoque esteve errado por 30 dias; o estorno é de hoje, não retroativo.
    assert compensacao.movement_date > antiga.movement_date


def test_produto_sem_movimentacao_tem_saldo_zero(db, produto):
    outro = db.query(Product).filter(Product.name == "Açúcar 1kg").first()
    assert derived_stock(db, outro.id) == 0
