from datetime import datetime

from sqlalchemy.orm import Session

from app.models.deposit import Deposit
from app.models.product import Product
from app.models.stock import StockMovement
from app.schemas.stock import StockBalanceItem, StockMovementReportItem
from app.utils.helpers import product_label


def build_stock_balance(
    db: Session,
    deposit_id: int | None,
    start_date: datetime | None,
    end_date: datetime | None,
    allowed_deposit_ids: list[int] | None,
) -> list[StockBalanceItem]:
    if allowed_deposit_ids is not None and not allowed_deposit_ids:
        return []
    query = db.query(StockMovement, Product.cost_price, Product.price).join(
        Product, Product.id == StockMovement.product_id,
    )
    query = _apply_filters(
        query, deposit_id, start_date, end_date, allowed_deposit_ids,
    )
    return _balance_items(query.all())


def _balance_items(rows) -> list[StockBalanceItem]:
    products = {}
    for movement, cost_price, product_price in rows:
        pid = movement.product_id
        if pid not in products:
            products[pid] = {
                "product_id": pid,
                "product_name": product_label(movement.product),
                "unit_abbr": movement.product.unit.abbreviation if movement.product.unit else "",
                "quantity_entries": 0,
                "quantity_exits": 0,
                "total_value_entries": 0.0,
                "total_value_exits": 0.0,
            }
        _add_balance_movement(products[pid], movement, cost_price, product_price)

    return [
        StockBalanceItem(
            product_id=item["product_id"],
            product_name=item["product_name"],
            unit_abbr=item["unit_abbr"],
            quantity_entries=item["quantity_entries"],
            quantity_exits=item["quantity_exits"],
            balance=item["quantity_entries"] - item["quantity_exits"],
            total_value_entries=item["total_value_entries"],
            total_value_exits=item["total_value_exits"],
        )
        for item in sorted(products.values(), key=lambda value: value["product_name"])
    ]


def _add_balance_movement(item, movement, cost_price, product_price) -> None:
    if movement.movement_type == "entrada":
        item["quantity_entries"] += movement.quantity
        effective_price = movement.unit_price
        if not effective_price or effective_price == 0:
            effective_price = cost_price or product_price or 0
        item["total_value_entries"] += movement.quantity * effective_price
        return
    item["quantity_exits"] += movement.quantity
    item["total_value_exits"] += movement.total_value or 0


def build_stock_movement_report(
    db: Session,
    deposit_id: int | None,
    start_date: datetime | None,
    end_date: datetime | None,
    allowed_deposit_ids: list[int] | None,
) -> list[StockMovementReportItem]:
    if allowed_deposit_ids is not None and not allowed_deposit_ids:
        return []
    query = (
        db.query(StockMovement, Product.cost_price, Product.price)
        .join(Product, Product.id == StockMovement.product_id)
        .join(Deposit, Deposit.id == StockMovement.deposit_id)
    )
    query = _apply_filters(
        query, deposit_id, start_date, end_date, allowed_deposit_ids,
    )
    rows = query.order_by(StockMovement.movement_date.desc()).all()
    return [_movement_report_item(movement, cost, price) for movement, cost, price in rows]


def _movement_report_item(movement, cost_price, product_price) -> StockMovementReportItem:
    effective_price = _effective_price(movement, cost_price, product_price)
    total_value = (
        movement.total_value
        if movement.unit_price and movement.unit_price > 0
        else movement.quantity * (cost_price or product_price or 0)
    )
    return StockMovementReportItem(
        id=movement.id,
        product_id=movement.product_id,
        product_name=product_label(movement.product),
        deposit_id=movement.deposit_id,
        deposit_name=movement.deposit.name,
        movement_type=movement.movement_type,
        movement_date=movement.movement_date,
        quantity=movement.quantity,
        unit_price=effective_price,
        total_value=total_value,
        reason=movement.reason,
        created_at=movement.created_at,
    )


def _effective_price(movement, cost_price, product_price) -> float:
    if movement.unit_price and movement.unit_price > 0:
        return movement.unit_price
    return cost_price or product_price or 0


def _apply_filters(
    query,
    deposit_id: int | None,
    start_date: datetime | None,
    end_date: datetime | None,
    allowed_deposit_ids: list[int] | None,
):
    if allowed_deposit_ids is not None:
        query = query.filter(StockMovement.deposit_id.in_(allowed_deposit_ids))
    if deposit_id:
        query = query.filter(StockMovement.deposit_id == deposit_id)
    if start_date:
        query = query.filter(StockMovement.movement_date >= start_date)
    if end_date:
        query = query.filter(StockMovement.movement_date <= end_date)
    return query
