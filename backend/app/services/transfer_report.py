from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.deposit import Deposit
from app.models.product import Product
from app.models.stock import StockMovement
from app.schemas.stock import TransferReportItem
from app.utils.helpers import product_label


def build_transfer_report(
    db: Session,
    deposits: list[Deposit],
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> list[TransferReportItem]:
    result = []
    for deposit in deposits:
        result.extend(_report_for_deposit(db, deposit, start_date, end_date))
    return result


def _report_for_deposit(
    db: Session,
    deposit: Deposit,
    start_date: datetime | None,
    end_date: datetime | None,
) -> list[TransferReportItem]:
    parent_name = _parent_name(db, deposit)
    abastecimento_spec, devolucao_spec = _movement_specs(deposit, parent_name)
    abastecimento_data = _aggregate_movements(db, deposit.id, *abastecimento_spec, start_date, end_date)
    devolucao_data = _aggregate_movements(db, deposit.id, *devolucao_spec, start_date, end_date)
    avaria_data = _aggregate_movements(
        db,
        deposit.id,
        "saida",
        "Avaria:%",
        start_date,
        end_date,
        include_price=False,
    )
    product_ids = set(abastecimento_data) | set(devolucao_data) | set(avaria_data)
    products = _products_by_id(db, product_ids)
    return [
        item
        for product_id in sorted(product_ids)
        if (
            item := _build_report_item(
                deposit,
                product_id,
                products.get(product_id),
                abastecimento_data,
                devolucao_data,
                avaria_data,
            )
        )
        is not None
    ]


def _parent_name(db: Session, deposit: Deposit) -> str | None:
    if not deposit.parent_id:
        return None
    parent = db.query(Deposit).filter(Deposit.id == deposit.parent_id).first()
    return parent.name if parent else "?"


def _movement_specs(
    deposit: Deposit,
    parent_name: str | None,
) -> tuple[tuple[str, str], tuple[str, str]]:
    if deposit.parent_id:
        return (
            ("entrada", f"%Abastecimento%{parent_name}%"),
            ("saida", "%Devolução%"),
        )
    return (
        ("saida", "%Abastecimento%"),
        ("entrada", "%Devolução%"),
    )


def _aggregate_movements(
    db: Session,
    deposit_id: int,
    movement_type: str,
    reason_pattern: str,
    start_date: datetime | None,
    end_date: datetime | None,
    include_price: bool = True,
) -> dict[int, object]:
    columns = [
        StockMovement.product_id,
        func.sum(StockMovement.quantity).label("total_qty"),
    ]
    if include_price:
        columns.append(func.avg(StockMovement.unit_price).label("avg_price"))
    query = db.query(*columns).filter(
        StockMovement.deposit_id == deposit_id,
        StockMovement.movement_type == movement_type,
        StockMovement.reason.like(reason_pattern),
    )
    if start_date:
        query = query.filter(StockMovement.movement_date >= start_date)
    if end_date:
        query = query.filter(StockMovement.movement_date <= end_date)
    return {row.product_id: row for row in query.group_by(StockMovement.product_id).all()}


def _products_by_id(db: Session, product_ids: set[int]) -> dict[int, Product]:
    if not product_ids:
        return {}
    products = db.query(Product).filter(Product.id.in_(product_ids)).all()
    return {product.id: product for product in products}


def _build_report_item(
    deposit: Deposit,
    product_id: int,
    product: Product | None,
    abastecimento_data: dict[int, object],
    devolucao_data: dict[int, object],
    avaria_data: dict[int, object],
) -> TransferReportItem | None:
    abastecimento = abastecimento_data.get(product_id)
    devolucao = devolucao_data.get(product_id)
    avaria = avaria_data.get(product_id)
    abastecimento_qty, devolucao_qty, avaria_qty = _movement_quantities(
        abastecimento, devolucao, avaria,
    )
    if abastecimento_qty == 0 and devolucao_qty == 0 and avaria_qty == 0:
        return None
    avg_price = _average_price(abastecimento, devolucao)
    venda_qty = max(0, abastecimento_qty - devolucao_qty - avaria_qty)
    return TransferReportItem(
        deposit_id=deposit.id,
        deposit_name=deposit.name,
        product_id=product_id,
        product_name=product_label(product) or f"Produto #{product_id}",
        abastecimento_qty=abastecimento_qty,
        devolucao_qty=devolucao_qty,
        avaria_qty=avaria_qty,
        venda_qty=venda_qty,
        unit_price=avg_price,
        venda_total=venda_qty * avg_price,
    )


def _movement_quantities(abastecimento, devolucao, avaria) -> tuple[float, float, float]:
    return tuple(
        movement.total_qty if movement else 0
        for movement in (abastecimento, devolucao, avaria)
    )


def _average_price(abastecimento, devolucao) -> float:
    if abastecimento:
        return abastecimento.avg_price or 0
    if devolucao:
        return devolucao.avg_price or 0
    return 0
