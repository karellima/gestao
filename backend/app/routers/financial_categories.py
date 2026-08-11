from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.financial_category import FinancialCategory
from app.schemas.financial_category import (
    FinancialCategoryCreate,
    FinancialCategoryResponse,
    FinancialCategoryUpdate,
)
from app.utils.security import get_current_user, require_module

router = APIRouter(prefix="/api/financial-categories", tags=["Categorias Financeiras"])


@router.get("/", response_model=list[FinancialCategoryResponse])
def list_categories(
    type: str | None = None,
    parent_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_module("financial_categories")),
):
    query = db.query(FinancialCategory).filter(FinancialCategory.is_active == True)
    if type:
        query = query.filter(FinancialCategory.type == type)
    if parent_id is not None:
        query = query.filter(FinancialCategory.parent_id == parent_id)
    else:
        query = query.filter(FinancialCategory.parent_id == None)
    return query.all()


@router.get("/all", response_model=list[FinancialCategoryResponse])
def list_all_categories(
    type: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_module("financial_categories")),
):
    query = db.query(FinancialCategory)
    if type:
        query = query.filter(FinancialCategory.type == type)
    return query.all()


@router.post("/", response_model=FinancialCategoryResponse)
def create_category(
    category: FinancialCategoryCreate,
    db: Session = Depends(get_db),
    _=Depends(require_module("financial_categories", "edit")),
):
    db_cat = FinancialCategory(**category.model_dump())
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat


@router.put("/{category_id}", response_model=FinancialCategoryResponse)
def update_category(
    category_id: int,
    category: FinancialCategoryUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_module("financial_categories", "edit")),
):
    db_cat = db.query(FinancialCategory).filter(FinancialCategory.id == category_id).first()
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
    _=Depends(require_module("financial_categories", "edit")),
):
    db_cat = db.query(FinancialCategory).filter(FinancialCategory.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    db.delete(db_cat)
    db.commit()
    return {"message": "Categoria removida"}
