"""Reparo de estoque — comando sob demanda, nunca rotina de boot.

Este módulo existia, na prática, dentro de ``app/main.py``: a cada subida do
processo o app apagava movimentações de requisições não recebidas e recalculava
o saldo de *todos* os produtos. Isso reescrevia histórico sem pedir licença,
sem registro de quem/quando, e repetia a cada deploy e a cada worker do uvicorn.

Aqui o reparo é explícito:

* roda quando um humano manda (CLI ou endpoint de admin), não no import;
* ``dry_run=True`` por padrão — primeiro mostra, só corrige se mandarem;
* corrige por **compensação**: a movimentação errada continua no histórico e
  ganha uma inversa ao lado (ver :func:`app.services.stock_ledger.compensate_movement`);
* registra tudo em log e devolve um relatório do que fez.
"""

import logging
from datetime import UTC, datetime

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.requisicao import Requisicao
from app.models.stock import StockMovement
from app.services.stock_ledger import (
    ENTRADA,
    SAIDA,
    SOURCE_REPARO,
    compensate_movement,
    is_compensated,
    lock_stock_products,
)
from app.utils.helpers import product_label

logger = logging.getLogger("app.stock.reparo")

#: Diferença abaixo da qual saldo divergente é ruído de ponto flutuante.
TOLERANCIA = 1e-6


def find_orphan_requisicao_exits(
    db: Session,
    product_ids: set[int] | None = None,
) -> list[dict]:
    """Saídas gravadas para requisições que nunca chegaram a ser recebidas.

    Resíduo do fluxo antigo, em que a saída era gravada no atendimento. Hoje
    ``receive_requisicao`` só grava no recebimento, então estas linhas são
    sempre dados legados — e por isso o reparo é pontual, não recorrente.
    """
    pendentes = {
        rid for (rid,) in db.query(Requisicao.id).filter(Requisicao.status != "recebido").all()
    }
    if not pendentes:
        return []

    query = db.query(StockMovement).filter(
        StockMovement.movement_type == SAIDA,
        StockMovement.source == "requisicao",
    )
    if product_ids is not None:
        query = query.filter(StockMovement.product_id.in_(product_ids))
    candidatas = query.all()

    orfas = []
    for mov in candidatas:
        requisicao_id = _requisicao_id_from_reason(mov.reason)
        if requisicao_id is None or requisicao_id not in pendentes:
            continue
        if is_compensated(db, mov.id):
            continue  # já estornada num reparo anterior
        orfas.append({
            "movement_id": mov.id,
            "requisicao_id": requisicao_id,
            "product_id": mov.product_id,
            "deposit_id": mov.deposit_id,
            "quantity": mov.quantity,
            "reason": mov.reason,
            "_movement": mov,
        })
    return orfas


def _requisicao_id_from_reason(reason: str | None) -> int | None:
    """Extrai o número da requisição de ``"Requisição #12: motivo"``."""
    if not reason or not reason.startswith("Requisição #"):
        return None
    resto = reason[len("Requisição #"):]
    numero, sep, _ = resto.partition(":")
    if not sep:
        return None
    try:
        return int(numero.strip())
    except ValueError:
        return None


def find_stock_divergences(
    db: Session,
    product_ids: set[int] | None = None,
) -> list[dict]:
    """Produtos cujo cache ``current_stock`` não bate com o histórico.

    Soma o histórico inteiro numa consulta agrupada, em vez de duas por produto:
    o comando roda contra a base de produção, às vezes por HTTP.
    """
    db.flush()  # compensações recém-criadas têm de entrar na soma
    movement_query = db.query(
        StockMovement.product_id,
        func.sum(case(
            (StockMovement.movement_type == ENTRADA, StockMovement.quantity),
            else_=-StockMovement.quantity,
        )),
    )
    product_query = db.query(Product)
    if product_ids is not None:
        movement_query = movement_query.filter(StockMovement.product_id.in_(product_ids))
        product_query = product_query.filter(Product.id.in_(product_ids))
    saldos = dict(movement_query.group_by(StockMovement.product_id).all())

    divergentes = []
    for product in product_query.all():
        derivado = saldos.get(product.id) or 0
        atual = product.current_stock or 0
        if abs(derivado - atual) <= TOLERANCIA:
            continue
        divergentes.append({
            "product_id": product.id,
            "product_name": product_label(product),
            "current_stock": atual,
            "derived_stock": derivado,
            "delta": derivado - atual,
            "_product": product,
        })
    return divergentes


def repair_stock(
    db: Session,
    *,
    dry_run: bool = True,
    user_id: int | None = None,
    compensate_orphans: bool = True,
    resync_cache: bool = True,
) -> dict:
    """Inspeciona — e, se ``dry_run=False``, corrige — o estado do estoque.

    Duas correções, de naturezas diferentes:

    * **compensação de saídas órfãs**: escreve histórico novo (movimentação
      inversa). É a única forma de "desfazer" um lançamento aqui.
    * **re-sincronização do cache**: reescreve ``products.current_stock`` a
      partir do histórico. Não é histórico, é cache derivado — recalcular é
      inócuo, e é o que devolve o saldo à verdade depois da compensação.

    Devolve um relatório serializável com tudo que viu e tudo que fez.
    """
    iniciado_em = datetime.now(UTC)
    logger.info(
        "estoque.reparo.inicio dry_run=%s usuario=%s compensar_orfas=%s ressincronizar=%s",
        dry_run, user_id, compensate_orphans, resync_cache,
    )

    # O reparo pode tocar qualquer produto; trava todos em ordem estável para
    # não disputar o ledger/cache com vendas, requisições ou lançamentos.
    product_ids = {row.id for row in db.query(Product.id).all()}
    lock_stock_products(db, product_ids)

    # As compensações são sempre gravadas na transação, inclusive em dry-run:
    # é o que faz a simulação prever o saldo final de verdade. O rollback no
    # fim descarta tudo se for só ensaio.
    orfas = (
        find_orphan_requisicao_exits(db, product_ids=product_ids)
        if compensate_orphans else []
    )
    compensacoes = []
    referencia = f"Reparo de estoque em {iniciado_em.isoformat(timespec='seconds')}"
    for orfa in orfas:
        mov = orfa["_movement"]
        compensacao = compensate_movement(
            db, mov,
            user_id=user_id,
            reason=f"Estorno mov. #{mov.id}: requisição #{orfa['requisicao_id']} não recebida",
            source=SOURCE_REPARO,
            notes=referencia,
            log=not dry_run,
        )
        compensacoes.append({
            "compensation_id": compensacao.id,
            "movement_id": mov.id,
            "product_id": mov.product_id,
            "quantity": mov.quantity,
        })

    # Calculado depois de compensar, então as compensações já entram na conta.
    divergencias = (
        find_stock_divergences(db, product_ids=product_ids)
        if resync_cache else []
    )
    ressincronizados = []

    for divergencia in divergencias:
        product = divergencia["_product"]
        product.current_stock = divergencia["derived_stock"]
        ressincronizados.append({
            "product_id": product.id,
            "product_name": divergencia["product_name"],
            "from": divergencia["current_stock"],
            "to": divergencia["derived_stock"],
        })
        if not dry_run:
            logger.info(
                "estoque.reparo.ressincronizacao produto=%s de=%s para=%s",
                product.id, divergencia["current_stock"], divergencia["derived_stock"],
            )

    if dry_run:
        db.rollback()
        compensacoes = [{**c, "compensation_id": None} for c in compensacoes]
    else:
        db.commit()

    relatorio = {
        "dry_run": dry_run,
        "executed_at": iniciado_em.isoformat(),
        "executed_by_user_id": user_id,
        "orphan_requisicao_exits": [
            {k: v for k, v in o.items() if not k.startswith("_")} for o in orfas
        ],
        "stock_divergences": [
            {k: v for k, v in d.items() if not k.startswith("_")} for d in divergencias
        ],
        "compensations_created": compensacoes,
        "products_resynced": ressincronizados,
    }

    logger.info(
        "estoque.reparo.fim dry_run=%s saidas_orfas=%s divergencias=%s "
        "compensacoes_criadas=%s produtos_ressincronizados=%s",
        dry_run, len(orfas), len(divergencias), len(compensacoes), len(ressincronizados),
    )
    return relatorio
