"""Livro-razão de estoque: o histórico de movimentações é imutável.

Regras que este módulo existe para garantir:

1. **Nada apaga movimentação.** Uma movimentação gravada é fato consumado.
   Erros são corrigidos por *compensação* — grava-se a movimentação inversa,
   que aponta para a original em ``compensates_movement_id``. As duas ficam
   no histórico e o saldo fecha em zero.
2. **``products.current_stock`` é cache derivado**, nunca fonte da verdade.
   A verdade é a soma das movimentações. Recalcular o cache é seguro; apagar
   movimentação para "acertar" o saldo, não.
3. **Reparo é sob demanda.** Nenhuma rotina deste módulo roda no boot da
   aplicação — quem repara é o comando em :mod:`app.services.stock_repair`,
   chamado explicitamente por um humano.
"""

import logging

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.stock import StockMovement

logger = logging.getLogger("app.stock")

ENTRADA = "entrada"
SAIDA = "saida"

#: ``source`` das movimentações criadas por estorno manual (correção de lançamento).
SOURCE_ESTORNO = "estorno"
#: ``source`` das movimentações criadas pelo comando de reparo.
SOURCE_REPARO = "reparo"


def lock_stock_products(db: Session, product_ids: set[int]) -> None:
    """Serializa escritores do ledger/cache, adquirindo locks em ordem estável."""
    if not product_ids:
        return
    db.query(Product.id).filter(Product.id.in_(product_ids)).order_by(
        Product.id,
    ).with_for_update().all()


def inverse_type(movement_type: str) -> str:
    """Tipo oposto ao informado — é isso que faz a compensação zerar o saldo."""
    return SAIDA if movement_type == ENTRADA else ENTRADA


def derived_stock(db: Session, product_id: int, deposit_id: int | None = None) -> float:
    """Saldo do produto calculado a partir do histórico (entradas - saídas).

    Sem ``deposit_id`` devolve o saldo global, que é o que ``current_stock``
    representa.
    """
    def total(movement_type: str) -> float:
        query = db.query(func.coalesce(func.sum(StockMovement.quantity), 0)).filter(
            StockMovement.product_id == product_id,
            StockMovement.movement_type == movement_type,
        )
        if deposit_id is not None:
            query = query.filter(StockMovement.deposit_id == deposit_id)
        return query.scalar() or 0

    return total(ENTRADA) - total(SAIDA)


def recalculate_product_stock(db: Session, product_id: int, commit: bool = True) -> float | None:
    """Re-sincroniza o cache ``products.current_stock`` com o histórico.

    Só toca no produto: nenhuma movimentação é criada, alterada ou apagada.
    Devolve o novo saldo, ou ``None`` se o produto não existir.
    """
    lock_stock_products(db, {product_id})
    db.flush()
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None
    product.current_stock = derived_stock(db, product_id)
    if commit:
        db.commit()
    return product.current_stock


def is_compensated(db: Session, movement_id: int) -> bool:
    """Já existe uma movimentação estornando esta?"""
    return db.query(StockMovement.id).filter(
        StockMovement.compensates_movement_id == movement_id
    ).first() is not None


def compensate_movement(
    db: Session,
    movement: StockMovement,
    *,
    user_id: int | None = None,
    reason: str | None = None,
    source: str = SOURCE_ESTORNO,
    notes: str | None = None,
    log: bool = True,
) -> StockMovement:
    """Grava a movimentação inversa que anula ``movement``, preservando as duas.

    A compensação é datada de *agora*, não da movimentação original: o estoque
    esteve mesmo errado no intervalo, e o histórico deve mostrar isso.

    Não faz commit — quem chama decide a fronteira da transação. Passe
    ``log=False`` em simulações, para não registrar como feito o que vai ser
    descartado no rollback.
    """
    lock_stock_products(db, {movement.product_id})
    original_reason = movement.reason or ""
    compensation = StockMovement(
        product_id=movement.product_id,
        deposit_id=movement.deposit_id,
        movement_type=inverse_type(movement.movement_type),
        quantity=movement.quantity,
        unit_price=movement.unit_price or 0,
        total_value=(movement.quantity or 0) * (movement.unit_price or 0),
        reason=reason or f"Estorno mov. #{movement.id}: {original_reason}".strip(),
        notes=notes,
        source=source,
        compensates_movement_id=movement.id,
        user_id=user_id,
    )
    db.add(compensation)
    db.flush()
    if not log:
        return compensation
    logger.info(
        "estoque.compensacao movimento_original=%s produto=%s deposito=%s "
        "tipo=%s->%s quantidade=%s origem=%s usuario=%s",
        movement.id, movement.product_id, movement.deposit_id,
        movement.movement_type, compensation.movement_type,
        movement.quantity, source, user_id,
    )
    return compensation
