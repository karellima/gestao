import os
import tempfile
from contextlib import suppress

import openpyxl
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.services.product_import import InvalidProductImportFile, import_products
from app.utils.security import get_current_user, is_admin_user, require_module, user_deposit_ids


def _is_admin(db: Session, user: User) -> bool:
    return is_admin_user(db, user)


def cleanup(path: str):
    with suppress(FileNotFoundError):
        os.unlink(path)


def sync_markup(product, explicit_markup=False, explicit_price=False):
    """Mantém coerentes Preço de Venda e Markup a partir do Preço de Custo.
    Se o markup foi informado, recalcula o preço de venda;
    caso contrário, se o preço de venda foi informado, calcula o markup."""
    cost = product.cost_price
    if not cost or cost <= 0:
        return
    if explicit_markup and product.markup and product.markup > 0:
        product.price = round(cost * product.markup, 2)
    elif explicit_price and product.price and product.price > 0:
        product.markup = round(product.price / cost, 4)


class ImportResult(BaseModel):
    imported: int
    errors: list[str]

router = APIRouter(prefix="/api/products", tags=["Produtos"])


@router.get("/", response_model=list[ProductResponse])
def list_products(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    category_id: int | None = None,
    deposit_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("products")),
):
    query = db.query(Product).filter(Product.is_active.is_(True))
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if not deposit_ids:
            return []
        query = query.filter(Product.deposit_id.in_(deposit_ids))
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if deposit_id:
        query = query.filter(Product.deposit_id == deposit_id)
    return query.offset(skip).limit(limit).all()


@router.get("/export-template")
def export_template(background_tasks: BackgroundTasks, _=Depends(require_module("products"))):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Produtos"
    ws.append(["Nome", "SKU", "Descrição", "Código de Barras", "Preço Venda",
               "Preço Custo", "Categoria", "Subcategoria", "Unidade"])
    for col, w in [("A",30), ("B",20), ("C",40), ("D",20), ("E",14), ("F",14), ("G",20), ("H",20), ("I",14)]:
        ws.column_dimensions[col].width = w

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        wb.save(tmp.name)
        tmp_path = tmp.name
    wb.close()
    background_tasks.add_task(cleanup, tmp_path)

    return FileResponse(
        tmp_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="modelo_importacao_produtos.xlsx",
        headers={"Access-Control-Expose-Headers": "Content-Disposition"},
    )


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("products")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if product.deposit_id not in deposit_ids:
            raise HTTPException(status_code=404, detail="Produto não encontrado")
    return product


@router.post("/", response_model=ProductResponse)
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("products", "edit")),
):
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if product.deposit_id and product.deposit_id not in deposit_ids:
            raise HTTPException(status_code=403, detail="Sem acesso a este depósito")
    existing = db.query(Product).filter(Product.sku == product.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="SKU já cadastrado")
    db_product = Product(**product.model_dump())
    sync_markup(db_product, explicit_markup=bool(product.markup), explicit_price=bool(product.price))
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("products", "edit")),
):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if db_product.deposit_id not in deposit_ids:
            raise HTTPException(status_code=403, detail="Sem acesso a este depósito")
        if product.deposit_id is not None and product.deposit_id not in deposit_ids:
            raise HTTPException(status_code=403, detail="Sem acesso ao depósito de destino")
    if product.sku:
        dup_sku = db.query(Product).filter(Product.sku == product.sku, Product.id != product_id).first()
        if dup_sku:
            raise HTTPException(status_code=400, detail="SKU já cadastrado")
    data = product.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(db_product, key, value)
    sync_markup(
        db_product,
        explicit_markup=bool(data.get("markup")),
        explicit_price=bool(data.get("price")),
    )
    db.commit()
    db.refresh(db_product)
    return db_product


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("products", "edit")),
):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if db_product.deposit_id not in deposit_ids:
            raise HTTPException(status_code=403, detail="Sem acesso a este depósito")
    db_product.is_active = False
    db.commit()
    return {"message": "Produto removido"}


@router.post("/import-excel", response_model=ImportResult)
def import_products_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_module("products", "edit")),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Formato inválido. Envie um arquivo .xlsx ou .xls")

    try:
        result = import_products(file.file.read(), db)
    except InvalidProductImportFile as exc:
        raise HTTPException(400, "Arquivo Excel inválido") from exc
    return ImportResult(imported=result.imported, errors=result.errors)


@router.get("/low-stock/", response_model=list[ProductResponse])
def get_low_stock_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("products")),
):
    query = (
        db.query(Product)
        .filter(Product.is_active.is_(True), Product.current_stock <= Product.min_stock)
    )
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if not deposit_ids:
            return []
        query = query.filter(Product.deposit_id.in_(deposit_ids))
    return query.all()
