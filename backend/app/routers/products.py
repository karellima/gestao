from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.product import Product, Category
from app.models.unit import Unit
from app.models.role import Role
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.utils.security import get_current_user, require_module
import openpyxl
import io
import os
import tempfile


def _is_admin(db: Session, user: User) -> bool:
    if user.role == "admin":
        return True
    role = db.query(Role).filter(Role.name == user.role).first()
    return bool(role and role.is_admin)


def _user_deposit_ids(user: User) -> List[int]:
    return [d.id for d in user.deposits] if user.deposits else []


def cleanup(path: str):
    try: os.unlink(path)
    except: pass


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
    errors: List[str]

router = APIRouter(prefix="/api/products", tags=["Produtos"])


@router.get("/", response_model=List[ProductResponse])
def list_products(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    deposit_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("products")),
):
    query = db.query(Product).filter(Product.is_active == True)
    if not _is_admin(db, current_user):
        deposit_ids = _user_deposit_ids(current_user)
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

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    wb.save(tmp.name)
    wb.close()
    background_tasks.add_task(cleanup, tmp.name)

    return FileResponse(
        tmp.name,
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
        deposit_ids = _user_deposit_ids(current_user)
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
        deposit_ids = _user_deposit_ids(current_user)
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
        deposit_ids = _user_deposit_ids(current_user)
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
        deposit_ids = _user_deposit_ids(current_user)
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

    contents = file.file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents))
    ws = wb.active

    headers = [str(c.value).strip().lower() if c.value else "" for c in next(ws.iter_rows())]
    has_cost_price = "preco custo" in headers or "preço custo" in headers
    has_stock = any("estoque" in h for h in headers)
    # Column layout always: 0=Nome, 1=SKU, 2=Desc, 3=CodBarras, 4=PrecoVenda
    # Then 5=PrecoCusto (if exists), else 5=Categoria
    ci = 5 if not has_cost_price else 6

    rows = list(ws.iter_rows(min_row=2, values_only=True))
    imported = 0
    errors = []

    units_map = {u.abbreviation.strip().lower(): u.id for u in db.query(Unit).all()}
    units_names = {u.name.strip().lower(): u.id for u in db.query(Unit).all()}
    cats_list = db.query(Category).all()
    cats_by_name = {}
    for c in cats_list:
        key = c.name.strip().lower()
        if key not in cats_by_name:
            cats_by_name[key] = []
        cats_by_name[key].append(c)

    for i, row in enumerate(rows, start=2):
        try:
            if not row or all(v is None for v in row):
                continue
            name = str(row[0]).strip() if row[0] else ""
            sku = str(row[1]).strip() if row[1] else ""
            if not name or not sku:
                errors.append(f"Linha {i}: Nome e SKU são obrigatórios")
                continue

            category_name = str(row[ci]).strip() if len(row) > ci and row[ci] else ""
            sub_name = str(row[ci + 1]).strip() if len(row) > ci + 1 and row[ci + 1] else ""
            unit_val = str(row[ci + 2]).strip().lower() if len(row) > ci + 2 and row[ci + 2] else ""

            category_id = None
            if category_name or sub_name:
                target_cat = category_name.lower() if category_name else ""
                target_sub = sub_name.lower() if sub_name else ""

                if target_sub:
                    candidates = cats_by_name.get(target_sub, [])
                    if target_cat:
                        parent_ids = {c.id for c in cats_by_name.get(target_cat, []) if not c.parent_id}
                        matches = [c for c in candidates if c.parent_id in parent_ids]
                    else:
                        matches = [c for c in candidates if c.parent_id is not None]
                    if len(matches) == 1:
                        category_id = matches[0].id
                    elif len(matches) == 0:
                        detail = f"Subcategoria '{sub_name}'" + (f" sob '{category_name}'" if category_name else "") + " não encontrada"
                        errors.append(f"Linha {i}: {detail}")
                        continue
                    else:
                        detail = f"Subcategoria '{sub_name}' é ambígua. Especifique também a categoria pai."
                        errors.append(f"Linha {i}: {detail}")
                        continue
                elif target_cat:
                    candidates = cats_by_name.get(target_cat, [])
                    parents = [c for c in candidates if c.parent_id is None]
                    if len(parents) == 1:
                        category_id = parents[0].id
                    else:
                        errors.append(f"Linha {i}: Categoria '{category_name}' não encontrada")
                        continue

            unit_id = None
            if unit_val:
                unit_id = units_map.get(unit_val) or units_names.get(unit_val)
                if not unit_id:
                    errors.append(f"Linha {i}: Unidade '{row[ci + 2].strip()}' não encontrada")
                    continue

            existing = db.query(Product).filter(Product.sku == sku).first()
            data = {
                "name": name,
                "sku": sku,
                "description": str(row[2]).strip() if len(row) > 2 and row[2] else None,
                "barcode": str(row[3]).strip() if len(row) > 3 and row[3] else None,
                "price": float(row[4]) if len(row) > 4 and row[4] is not None else None,
                "cost_price": float(row[5]) if has_cost_price and len(row) > 5 and row[5] is not None else None,
                "category_id": category_id,
                "unit_id": unit_id,
            }

            if existing:
                for key, value in data.items():
                    if value is not None:
                        setattr(existing, key, value)
            else:
                if has_stock:
                    sc = ci + 3  # stock current
                    sm = ci + 4  # stock min
                    data["current_stock"] = float(row[sc]) if len(row) > sc and row[sc] is not None else 0
                    data["min_stock"] = float(row[sm]) if len(row) > sm and row[sm] is not None else 0
                db.add(Product(**data))

            imported += 1
        except Exception as e:
            errors.append(f"Linha {i}: {str(e)}")

    db.commit()
    wb.close()
    return ImportResult(imported=imported, errors=errors)


@router.get("/low-stock/", response_model=List[ProductResponse])
def get_low_stock_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("products")),
):
    query = (
        db.query(Product)
        .filter(Product.is_active == True, Product.current_stock <= Product.min_stock)
    )
    if not _is_admin(db, current_user):
        deposit_ids = _user_deposit_ids(current_user)
        if not deposit_ids:
            return []
        query = query.filter(Product.deposit_id.in_(deposit_ids))
    return query.all()
