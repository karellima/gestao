"""Integra vendas ao livro-razão imutável de estoque."""

from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.stock import StockMovement
from app.services.stock_ledger import (
    SAIDA,
    compensate_movement,
    derived_stock,
    is_compensated,
    lock_stock_products,
    recalculate_product_stock,
)

SOURCE_VENDA = "venda"
QUANTITY_TOLERANCE = 1e-6


def _sale_reason(sale_id: int) -> str:
    return f"Venda #{sale_id}"


def _sync_products(db: Session, product_ids: set[int]) -> None:
    for product_id in product_ids:
        recalculate_product_stock(db, product_id, commit=False)


def lock_sale(db: Session, sale_id: int) -> Sale | None:
    """Serializa alterações/exclusão da mesma venda."""
    return db.query(Sale).filter(Sale.id == sale_id).with_for_update().first()


def record_sale_stock(
    db: Session,
    sale_id: int,
    user_id: int | None,
    *,
    products_locked: bool = False,
) -> None:
    """Grava uma saída para cada item da versão vigente da venda."""
    product_ids: set[int] = set()
    items = db.query(SaleItem).filter(SaleItem.sale_id == sale_id).all()
    item_product_ids = {item.product_id for item in items}
    if not products_locked:
        lock_stock_products(db, item_product_ids)
    products = {
        product.id: product
        for product in db.query(Product).filter(Product.id.in_(item_product_ids)).all()
    }
    quantities = defaultdict(float)
    for item in items:
        quantities[item.product_id] += item.quantity
    for product_id, quantity in quantities.items():
        product = products.get(product_id)
        if product is None or product.deposit_id is None:
            raise ValueError(f"Produto id={product_id} não possui depósito de estoque")
        available = derived_stock(db, product_id, product.deposit_id)
        if quantity - available > QUANTITY_TOLERANCE:
            raise ValueError(
                f"Estoque insuficiente para {product.name}: "
                f"disponível {available:g}, solicitado {quantity:g}"
            )
    for item in items:
        product = products[item.product_id]
        db.add(StockMovement(
            product_id=item.product_id,
            deposit_id=product.deposit_id,
            movement_type=SAIDA,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_value=item.total_price,
            reason=_sale_reason(sale_id),
            notes="Saída automática pelo lançamento de venda",
            source=SOURCE_VENDA,
            user_id=user_id,
        ))
        product_ids.add(item.product_id)
    db.flush()
    _sync_products(db, product_ids)


def compensate_sale_stock(
    db: Session,
    sale_id: int,
    user_id: int | None,
) -> None:
    """Compensa as saídas vigentes da venda sem apagar nenhuma movimentação."""
    base_query = db.query(StockMovement).filter(
        StockMovement.source == SOURCE_VENDA,
        StockMovement.reason == _sale_reason(sale_id),
        StockMovement.compensates_movement_id.is_(None),
    )
    product_ids = {
        row.product_id
        for row in base_query.with_entities(StockMovement.product_id).distinct()
    }
    lock_stock_products(db, product_ids)
    originals = base_query.order_by(StockMovement.id).with_for_update().all()
    product_ids: set[int] = set()
    for movement in originals:
        if is_compensated(db, movement.id):
            continue
        compensate_movement(
            db,
            movement,
            user_id=user_id,
            reason=f"Estorno da venda #{sale_id}",
            notes="Compensação automática por alteração ou exclusão da venda",
        )
        product_ids.add(movement.product_id)
    _sync_products(db, product_ids)
