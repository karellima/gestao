
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Category
from app.schemas.product import CategoryCreate, CategoryResponse, CategoryUpdate
from app.utils.security import require_module

router = APIRouter(prefix="/api/categories", tags=["Categorias de Produtos"])


@router.get("/", response_model=list[CategoryResponse])
def list_categories(
    parent_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_module("categories")),
):
    query = db.query(Category)
    if parent_id is not None:
        query = query.filter(Category.parent_id == parent_id)
    else:
        query = query.filter(Category.parent_id == None)
    return query.all()


@router.get("/all", response_model=list[CategoryResponse])
def list_all_categories(
    db: Session = Depends(get_db),
    _=Depends(require_module("categories")),
):
    return db.query(Category).all()


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("categories")),
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return cat


@router.post("/", response_model=CategoryResponse)
def create_category(
    category: CategoryCreate,
    db: Session = Depends(get_db),
    _=Depends(require_module("categories", "edit")),
):
    db_cat = Category(**category.model_dump())
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category: CategoryUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_module("categories", "edit")),
):
    db_cat = db.query(Category).filter(Category.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    for key, value in category.model_dump(exclude_unset=True).items():
        setattr(db_cat, key, value)
    db.commit()
    db.refresh(db_cat)
    return db_cat


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("categories", "edit")),
):
    db_cat = db.query(Category).filter(Category.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    db.delete(db_cat)
    db.commit()
    return {"message": "Categoria removida"}
