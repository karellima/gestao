from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sale import SaleType
from app.schemas.sale import SaleTypeCreate, SaleTypeResponse, SaleTypeUpdate
from app.utils.security import require_module

router = APIRouter()


@router.get("/", response_model=list[SaleTypeResponse])
def list_sale_types(
    db: Session = Depends(get_db),
    _=Depends(require_module("sale_types")),
):
    return db.query(SaleType).filter(SaleType.is_active == True).all()


@router.post("/", response_model=SaleTypeResponse)
def create_sale_type(
    data: SaleTypeCreate,
    db: Session = Depends(get_db),
    _=Depends(require_module("sale_types", "edit")),
):
    sale_type = SaleType(**data.model_dump())
    db.add(sale_type)
    db.commit()
    db.refresh(sale_type)
    return sale_type


@router.put("/{st_id}", response_model=SaleTypeResponse)
def update_sale_type(
    st_id: int,
    data: SaleTypeUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_module("sale_types", "edit")),
):
    sale_type = db.query(SaleType).filter(SaleType.id == st_id).first()
    if not sale_type:
        raise HTTPException(status_code=404, detail="Tipo de lançamento não encontrado")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(sale_type, key, value)
    db.commit()
    db.refresh(sale_type)
    return sale_type


@router.delete("/{st_id}")
def delete_sale_type(
    st_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("sale_types", "edit")),
):
    sale_type = db.query(SaleType).filter(SaleType.id == st_id).first()
    if not sale_type:
        raise HTTPException(status_code=404, detail="Tipo de lançamento não encontrado")
    sale_type.is_active = False
    db.commit()
    return {"message": "Tipo de lançamento removido"}
