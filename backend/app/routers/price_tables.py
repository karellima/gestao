
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.price_table import PriceTable, PriceTableItem
from app.models.product import Product
from app.schemas.price_table import (
    PriceTableCreate,
    PriceTableItemResponse,
    PriceTableResponse,
    PriceTableUpdate,
)
from app.utils.helpers import product_label
from app.utils.security import require_module


def _item_to_response(it: PriceTableItem) -> PriceTableItemResponse:
    return PriceTableItemResponse(
        id=it.id,
        product_id=it.product_id,
        product_name=product_label(it.product) if it.product else None,
        price=it.price,
    )


def _table_to_response(t: PriceTable) -> PriceTableResponse:
    return PriceTableResponse(
        id=t.id,
        name=t.name,
        description=t.description,
        is_active=t.is_active,
        created_at=t.created_at,
        updated_at=t.updated_at,
        items=[_item_to_response(it) for it in t.items],
    )


router = APIRouter(prefix="/api/price-tables", tags=["Tabelas de Preços"])


@router.get("/", response_model=list[PriceTableResponse])
def list_price_tables(
    db: Session = Depends(get_db),
    _=Depends(require_module("price_tables")),
):
    tables = (
        db.query(PriceTable)
        .options(joinedload(PriceTable.items).joinedload(PriceTableItem.product))
        .filter(PriceTable.is_active == True)
        .order_by(PriceTable.name)
        .all()
    )
    return [_table_to_response(t) for t in tables]


@router.get("/{table_id}", response_model=PriceTableResponse)
def get_price_table(
    table_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("price_tables")),
):
    t = (
        db.query(PriceTable)
        .options(joinedload(PriceTable.items).joinedload(PriceTableItem.product))
        .filter(PriceTable.id == table_id)
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Tabela de preços não encontrada")
    return _table_to_response(t)


@router.post("/", response_model=PriceTableResponse)
def create_price_table(
    data: PriceTableCreate,
    db: Session = Depends(get_db),
    _=Depends(require_module("price_tables", "edit")),
):
    t = PriceTable(name=data.name, description=data.description, is_active=True)
    for item in data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Produto id={item.product_id} não encontrado")
        t.items.append(PriceTableItem(product_id=item.product_id, price=item.price))
    db.add(t)
    db.commit()
    db.refresh(t)
    return _table_to_response(t)


@router.put("/{table_id}", response_model=PriceTableResponse)
def update_price_table(
    table_id: int,
    data: PriceTableUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_module("price_tables", "edit")),
):
    t = db.query(PriceTable).filter(PriceTable.id == table_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tabela de preços não encontrada")
    if data.name is not None:
        t.name = data.name
    if data.description is not None:
        t.description = data.description
    if data.items is not None:
        db.query(PriceTableItem).filter(PriceTableItem.price_table_id == t.id).delete()
        for item in data.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                raise HTTPException(status_code=400, detail=f"Produto id={item.product_id} não encontrado")
            db.add(PriceTableItem(price_table_id=t.id, product_id=item.product_id, price=item.price))
    db.commit()
    db.refresh(t)
    result = (
        db.query(PriceTable)
        .options(joinedload(PriceTable.items).joinedload(PriceTableItem.product))
        .filter(PriceTable.id == t.id)
        .first()
    )
    return _table_to_response(result)


@router.delete("/{table_id}")
def delete_price_table(
    table_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("price_tables", "edit")),
):
    t = db.query(PriceTable).filter(PriceTable.id == table_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tabela de preços não encontrada")
    t.is_active = False
    db.commit()
    return {"message": "Tabela de preços removida"}
