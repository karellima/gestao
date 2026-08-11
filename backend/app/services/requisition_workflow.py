from sqlalchemy.orm import Session

from app.models.requisicao import Requisicao, RequisicaoItem
from app.schemas.requisicao import RequisicaoItemUpdate, RequisicaoUpdate


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
