
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.unit import Unit
from app.schemas.unit import UnitCreate, UnitResponse, UnitUpdate
from app.utils.security import require_module

router = APIRouter(prefix="/api/units", tags=["Unidades de Medida"])


@router.get("/", response_model=list[UnitResponse])
def list_units(
    db: Session = Depends(get_db),
    _=Depends(require_module("units")),
):
    return db.query(Unit).filter(Unit.is_active == True).all()


@router.get("/{unit_id}", response_model=UnitResponse)
def get_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("units")),
):
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unidade não encontrada")
    return unit


@router.post("/", response_model=UnitResponse)
def create_unit(
    unit: UnitCreate,
    db: Session = Depends(get_db),
    _=Depends(require_module("units", "edit")),
):
    existing = db.query(Unit).filter(Unit.name == unit.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Unidade já cadastrada")
    db_unit = Unit(**unit.model_dump())
    db.add(db_unit)
    db.commit()
    db.refresh(db_unit)
    return db_unit


@router.put("/{unit_id}", response_model=UnitResponse)
def update_unit(
    unit_id: int,
    unit: UnitUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_module("units", "edit")),
):
    db_unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not db_unit:
        raise HTTPException(status_code=404, detail="Unidade não encontrada")
    for key, value in unit.model_dump(exclude_unset=True).items():
        setattr(db_unit, key, value)
    db.commit()
    db.refresh(db_unit)
    return db_unit


@router.delete("/{unit_id}")
def delete_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("units", "edit")),
):
    db_unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not db_unit:
        raise HTTPException(status_code=404, detail="Unidade não encontrada")
    db_unit.is_active = False
    db.commit()
    return {"message": "Unidade removida"}
