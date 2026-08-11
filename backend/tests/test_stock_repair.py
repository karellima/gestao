"""O reparo é sob demanda, simula por padrão e corrige por compensação."""

import pytest

from app.models.requisicao import Requisicao
from app.models.stock import StockMovement
from app.services.stock_ledger import SOURCE_REPARO
from app.services.stock_repair import (
    _requisicao_id_from_reason,
    find_orphan_requisicao_exits,
    find_stock_divergences,
    repair_stock,
)


@pytest.fixture()
def requisicao(db, admin, deposito):
    """Fábrica de requisições com a saída de estoque correspondente."""
    def _criar(status, produto_id, quantity=5):
        req = Requisicao(
            requester_id=admin.id,
            deposit_requesting_id=2,
            deposit_fulfilling_id=deposito.id,
            status=status,
            reason="reposição",
        )
        db.add(req)
        db.flush()
        mov = StockMovement(
            product_id=produto_id,
            deposit_id=deposito.id,
            movement_type="saida",
            quantity=quantity,
            unit_price=1.0,
            total_value=quantity,
            reason=f"Requisição #{req.id}: {req.reason}",
            source="requisicao",
            user_id=admin.id,
        )
        db.add(mov)
        db.commit()
        db.refresh(req)
        db.refresh(mov)
        return req, mov
    return _criar


def test_extrai_id_da_requisicao_do_motivo():
    assert _requisicao_id_from_reason("Requisição #42: reposição") == 42
    assert _requisicao_id_from_reason("Requisição #7:") == 7
    assert _requisicao_id_from_reason("Recebimento Requisição #7: x") is None
    assert _requisicao_id_from_reason("Avaria: caiu") is None
    assert _requisicao_id_from_reason("Requisição #abc: x") is None
    assert _requisicao_id_from_reason("Requisição #12 sem dois pontos") is None
    assert _requisicao_id_from_reason(None) is None


def test_encontra_saida_de_requisicao_nao_recebida(db, requisicao, produto):
    _, mov = requisicao("aprovado", produto.id)

    orfas = find_orphan_requisicao_exits(db)

    assert len(orfas) == 1
    assert orfas[0]["movement_id"] == mov.id


def test_requisicao_recebida_nao_e_orfa(db, requisicao, produto):
    requisicao("recebido", produto.id)

    assert find_orphan_requisicao_exits(db) == []


def test_dry_run_nao_grava_nada(db, requisicao, produto):
    requisicao("aprovado", produto.id)
    produto.current_stock = 999
    db.commit()
    movs_antes = db.query(StockMovement).count()

    relatorio = repair_stock(db, dry_run=True)

    assert relatorio["dry_run"] is True
    assert len(relatorio["orphan_requisicao_exits"]) == 1
    assert len(relatorio["compensations_created"]) == 1
    assert relatorio["compensations_created"][0]["compensation_id"] is None
    assert db.query(StockMovement).count() == movs_antes, "simulação não grava movimentação"
    db.refresh(produto)
    assert produto.current_stock == 999, "simulação não mexe no cache"


def test_dry_run_preve_o_saldo_final_com_a_compensacao(db, requisicao, produto):
    """A simulação calcula a divergência já contando o estorno que criaria."""
    requisicao("aprovado", produto.id, quantity=5)
    produto.current_stock = -5  # saldo coerente com a saída órfã
    db.commit()

    relatorio = repair_stock(db, dry_run=True)

    divergencia = next(d for d in relatorio["stock_divergences"] if d["product_id"] == produto.id)
    assert divergencia["derived_stock"] == 0, "prevê o saldo depois do estorno, não antes"
    assert divergencia["current_stock"] == -5


def test_apply_compensa_a_saida_orfa(db, requisicao, produto, admin):
    _, mov = requisicao("aprovado", produto.id, quantity=5)

    relatorio = repair_stock(db, dry_run=False, user_id=admin.id)

    assert relatorio["dry_run"] is False
    assert len(relatorio["compensations_created"]) == 1

    movs = db.query(StockMovement).order_by(StockMovement.id).all()
    assert len(movs) == 2, "a saída original continua no histórico"
    assert movs[0].id == mov.id
    assert movs[1].compensates_movement_id == mov.id
    assert movs[1].movement_type == "entrada"
    assert movs[1].quantity == 5
    assert movs[1].source == SOURCE_REPARO
    assert movs[1].user_id == admin.id

    db.refresh(produto)
    assert produto.current_stock == 0


def test_apply_e_idempotente(db, requisicao, produto):
    requisicao("aprovado", produto.id)

    repair_stock(db, dry_run=False)
    movs_depois_do_primeiro = db.query(StockMovement).count()
    segundo = repair_stock(db, dry_run=False)

    assert segundo["orphan_requisicao_exits"] == [], "a saída já estornada não reaparece"
    assert segundo["compensations_created"] == []
    assert db.query(StockMovement).count() == movs_depois_do_primeiro


def test_apply_ressincroniza_cache_divergente(db, nova_movimentacao, produto):
    nova_movimentacao(movement_type="entrada", quantity=10)
    produto.current_stock = 3
    db.commit()

    relatorio = repair_stock(db, dry_run=False)

    ressincronizado = next(
        r for r in relatorio["products_resynced"] if r["product_id"] == produto.id
    )
    assert ressincronizado["from"] == 3
    assert ressincronizado["to"] == 10
    db.refresh(produto)
    assert produto.current_stock == 10


def test_estoque_correto_nao_gera_divergencia(db, nova_movimentacao, produto):
    nova_movimentacao(movement_type="entrada", quantity=10)
    produto.current_stock = 10
    db.commit()

    assert find_stock_divergences(db) == []


def test_skip_flags_desligam_cada_reparo(db, requisicao, produto):
    requisicao("aprovado", produto.id)
    produto.current_stock = 42
    db.commit()

    relatorio = repair_stock(db, dry_run=True, compensate_orphans=False, resync_cache=False)

    assert relatorio["orphan_requisicao_exits"] == []
    assert relatorio["stock_divergences"] == []


def test_reparo_nunca_apaga_movimentacao(db, requisicao, nova_movimentacao, produto):
    """A garantia central: seja qual for o estado, o reparo só acrescenta linhas."""
    requisicao("aprovado", produto.id)
    requisicao("pendente", produto.id)
    nova_movimentacao(movement_type="entrada", quantity=30)
    ids_antes = {m.id for m in db.query(StockMovement).all()}

    repair_stock(db, dry_run=False)

    ids_depois = {m.id for m in db.query(StockMovement).all()}
    assert ids_antes <= ids_depois, "nenhuma movimentação pode ter sumido"
    assert len(ids_depois) == len(ids_antes) + 2, "só as duas compensações entraram"
