from sqlalchemy.orm import Session

from app.models.requisicao import Requisicao, RequisicaoItem
from app.models.stock import StockMovement
from app.schemas.requisicao import RequisicaoItemUpdate, RequisicaoUpdate
from app.services.stock_ledger import lock_stock_products, recalculate_product_stock


def apply_requisicao_update(
    requisicao: Requisicao,
    data: RequisicaoUpdate,
    db: Session,
) -> None:
    _update_requisicao_fields(requisicao, data)
    if data.items is not None:
        _sync_requisicao_items(requisicao, data, db)


def _update_requisicao_fields(requisicao: Requisicao, data: RequisicaoUpdate) -> None:
    for field in ("deposit_requesting_id", "deposit_fulfilling_id", "reason", "notes"):
        value = getattr(data, field)
        if value is not None:
            setattr(requisicao, field, value)


def _sync_requisicao_items(
    requisicao: Requisicao,
    data: RequisicaoUpdate,
    db: Session,
) -> None:
    existing_items = {item.id: item for item in requisicao.items}
    sent_ids = {item.id for item in data.items if item.id is not None}

    for item in requisicao.items:
        if item.id not in sent_ids:
            db.delete(item)

    for item_data in data.items:
        item = existing_items.get(item_data.id)
        if item is None:
            db.add(RequisicaoItem(
                requisicao_id=requisicao.id,
                product_id=item_data.product_id,
                quantity_requested=item_data.quantity_requested or 0,
                unit_price=item_data.unit_price,
            ))
            continue
        _update_item(item, item_data)


def _update_item(item: RequisicaoItem, data: RequisicaoItemUpdate) -> None:
    for field in ("product_id", "quantity_requested", "unit_price"):
        value = getattr(data, field)
        if value is not None:
            setattr(item, field, value)


def record_requisition_movements(
    db: Session,
    requisicao: Requisicao,
    quantidades: dict[int, tuple[float, float]],
    user_id: int,
) -> None:
    """Grava a saída e a entrada depois que o router valida o recebimento."""
    lock_stock_products(db, {item.product_id for item in requisicao.items})
    existing_saida = {m.product_id for m in db.query(StockMovement).filter(
        StockMovement.movement_type == "saida",
        StockMovement.reason.like(f"Requisição #{requisicao.id}:%"),
    ).all()}
    existing_entrada = {m.product_id for m in db.query(StockMovement).filter(
        StockMovement.movement_type == "entrada",
        StockMovement.reason.like(f"Recebimento Requisição #{requisicao.id}:%"),
    ).all()}
    for item in requisicao.items:
        _record_requisition_item(
            db, requisicao, item, quantidades, existing_saida, existing_entrada, user_id,
        )


def _record_requisition_item(
    db: Session,
    requisicao: Requisicao,
    item: RequisicaoItem,
    quantidades: dict[int, tuple[float, float]],
    existing_saida: set[int],
    existing_entrada: set[int],
    user_id: int,
) -> None:
    sent, received = quantidades[item.id]
    if sent > 0 and item.product_id not in existing_saida:
        _record_requisition_exit(db, requisicao, item, sent, user_id)
    if received <= 0:
        return
    if item.product_id not in existing_entrada:
        _record_requisition_entry(db, requisicao, item, received, user_id)


def _record_requisition_exit(
    db: Session,
    requisicao: Requisicao,
    item: RequisicaoItem,
    quantity: float,
    user_id: int,
) -> None:
    unit_price = item.unit_price or 0
    db.add(StockMovement(
        product_id=item.product_id,
        deposit_id=requisicao.deposit_fulfilling_id,
        movement_type="saida",
        quantity=quantity,
        unit_price=unit_price,
        total_value=quantity * unit_price,
        reason=f"Requisição #{requisicao.id}: {requisicao.reason or ''}",
        source="requisicao",
        user_id=user_id,
    ))
    recalculate_product_stock(db, item.product_id, commit=False)


def _record_requisition_entry(
    db: Session,
    requisicao: Requisicao,
    item: RequisicaoItem,
    quantity: float,
    user_id: int,
) -> None:
    unit_price = item.unit_price or 0
    db.add(StockMovement(
        product_id=item.product_id,
        deposit_id=requisicao.deposit_requesting_id,
        movement_type="entrada",
        quantity=quantity,
        unit_price=unit_price,
        total_value=quantity * unit_price,
        reason=f"Recebimento Requisição #{requisicao.id}: {requisicao.reason or ''}",
        source="requisicao",
        user_id=user_id,
    ))
    recalculate_product_stock(db, item.product_id, commit=False)
