from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contact import Contact
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.routers.sales.apresentacao import _sale_to_response
from app.routers.sales.consulta import query_sales
from app.schemas.sale import SaleCreate, SaleItemCreate, SaleResponse, SaleUpdate
from app.services.sale_access import (
    _is_admin,
    _product_deposit_ids_in_scope,
    is_sale_visible,
)
from app.services.sale_pricing import _client_table_prices, resolve_price
from app.services.sale_stock import compensate_sale_stock, lock_sale, record_sale_stock
from app.services.stock_ledger import lock_stock_products
from app.utils.security import get_current_user, require_module, user_deposit_ids

router = APIRouter()


def _ensure_update_scope(
    db: Session,
    current_user: User,
    sale: Sale,
    items: list[SaleItemCreate] | None,
) -> None:
    if _is_admin(db, current_user):
        return
    existing_product_ids = [item.product_id for item in sale.items]
    if not _product_deposit_ids_in_scope(db, current_user, existing_product_ids):
        raise HTTPException(status_code=403, detail="Sem acesso ao depósito dos produtos")
    if items is not None:
        new_product_ids = [item.product_id for item in items]
        if not _product_deposit_ids_in_scope(db, current_user, new_product_ids):
            raise HTTPException(
                status_code=403,
                detail="Sem acesso ao depósito de um dos novos produtos",
            )


def _apply_sale_fields(db: Session, sale: Sale, data: SaleUpdate) -> None:
    if data.contact_id is not None:
        contact = db.query(Contact).filter(Contact.id == data.contact_id).first()
        if not contact:
            raise HTTPException(status_code=400, detail="Cliente não encontrado")
        sale.contact_id = data.contact_id
    if data.sale_type_id is not None:
        sale.sale_type_id = data.sale_type_id
    if data.status is not None:
        sale.status = data.status
    if data.notes is not None:
        sale.notes = data.notes


def _build_sale_item(
    db: Session,
    table_prices: dict[int, float],
    item_data: SaleItemCreate,
    sale_id: int | None = None,
) -> SaleItem:
    product = db.query(Product).filter(Product.id == item_data.product_id).first()
    if not product:
        raise HTTPException(
            status_code=400,
            detail=f"Produto id={item_data.product_id} não encontrado",
        )
    unit_price = resolve_price(table_prices, db, item_data.product_id, item_data.unit_price)
    total_price = round(item_data.quantity * unit_price, 2)
    values = {
        "product_id": item_data.product_id,
        "quantity": item_data.quantity,
        "unit_price": unit_price,
        "total_price": total_price,
    }
    if sale_id is not None:
        values["sale_id"] = sale_id
    return SaleItem(**values)


def _replace_sale_items(
    db: Session,
    sale: Sale,
    items: list[SaleItemCreate],
    user_id: int,
) -> None:
    locked_product_ids = {item.product_id for item in sale.items}
    locked_product_ids.update(item.product_id for item in items)
    lock_stock_products(db, locked_product_ids)
    compensate_sale_stock(db, sale.id, user_id)
    db.query(SaleItem).filter(SaleItem.sale_id == sale.id).delete()
    table_prices = _client_table_prices(db, sale.contact_id)
    total = 0
    for item_data in items:
        item = _build_sale_item(db, table_prices, item_data, sale.id)
        total += item.total_price
        db.add(item)
    sale.total_amount = total
    db.flush()
    try:
        record_sale_stock(db, sale.id, user_id, products_locked=True)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/", response_model=list[SaleResponse])
def list_sales(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("sales")),
):
    sales = query_sales(db)
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if not deposit_ids:
            return []
        sales = sales.filter(
            Sale.items.any(SaleItem.product.has(Product.deposit_id.in_(deposit_ids)))
        )
    sales = sales.order_by(Sale.created_at.desc()).all()
    return [_sale_to_response(sale) for sale in sales]


@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("sales")),
):
    sale = query_sales(db).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    if not is_sale_visible(db, sale, current_user):
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    return _sale_to_response(sale)


@router.put("/{sale_id}", response_model=SaleResponse)
def update_sale(
    sale_id: int,
    data: SaleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("sales", "edit")),
):
    sale = lock_sale(db, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    _ensure_update_scope(db, current_user, sale, data.items)
    _apply_sale_fields(db, sale, data)
    if data.items is not None:
        _replace_sale_items(db, sale, data.items, current_user.id)
    db.commit()
    db.refresh(sale)
    result = query_sales(db).filter(Sale.id == sale.id).first()
    return _sale_to_response(result)


@router.delete("/{sale_id}")
def delete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("sales", "edit")),
):
    sale = lock_sale(db, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    if not _is_admin(db, current_user):
        product_ids = [item.product_id for item in sale.items]
        if not _product_deposit_ids_in_scope(db, current_user, product_ids):
            raise HTTPException(status_code=403, detail="Sem acesso ao depósito dos produtos")
    lock_stock_products(db, {item.product_id for item in sale.items})
    compensate_sale_stock(db, sale.id, current_user.id)
    db.delete(sale)
    db.commit()
    return {"message": "Lançamento removido"}


@router.post("/", response_model=SaleResponse)
def create_sale(
    data: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("sales", "edit")),
):
    contact = db.query(Contact).filter(Contact.id == data.contact_id).first()
    if not contact:
        raise HTTPException(status_code=400, detail="Cliente não encontrado")

    product_ids = [item.product_id for item in data.items]
    if not _product_deposit_ids_in_scope(db, current_user, product_ids):
        raise HTTPException(status_code=403, detail="Sem acesso ao depósito de um dos produtos")

    total = 0
    items = []
    table_prices = _client_table_prices(db, data.contact_id)
    for item_data in data.items:
        item = _build_sale_item(db, table_prices, item_data)
        total += item.total_price
        items.append(item)

    sale = Sale(
        contact_id=data.contact_id,
        sale_type_id=data.sale_type_id,
        total_amount=total,
        notes=data.notes,
        user_id=current_user.id,
        items=items,
    )
    db.add(sale)
    db.flush()
    lock_stock_products(db, set(product_ids))
    try:
        record_sale_stock(db, sale.id, current_user.id, products_locked=True)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error)) from error
    db.commit()
    db.refresh(sale)
    result = query_sales(db).filter(Sale.id == sale.id).first()
    return _sale_to_response(result)
