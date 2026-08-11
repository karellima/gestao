
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.payment_type import PaymentType
from app.schemas.payment_type import PaymentTypeCreate, PaymentTypeResponse, PaymentTypeUpdate
from app.utils.security import get_current_user, require_module

router = APIRouter(prefix="/api/payment-types", tags=["Tipos de Pagamento"])


@router.get("/", response_model=list[PaymentTypeResponse])
def list_payment_types(
    db: Session = Depends(get_db),
    _=Depends(require_module("payment_types")),
):
    return db.query(PaymentType).filter(PaymentType.is_active == True).all()


@router.get("/{pt_id}", response_model=PaymentTypeResponse)
def get_payment_type(
    pt_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("payment_types")),
):
    pt = db.query(PaymentType).filter(PaymentType.id == pt_id).first()
    if not pt:
        raise HTTPException(status_code=404, detail="Tipo de pagamento não encontrado")
    return pt


@router.post("/", response_model=PaymentTypeResponse)
def create_payment_type(
    payment_type: PaymentTypeCreate,
    db: Session = Depends(get_db),
    _=Depends(require_module("payment_types", "edit")),
):
    db_pt = PaymentType(**payment_type.model_dump())
    db.add(db_pt)
    db.commit()
    db.refresh(db_pt)
    return db_pt


@router.put("/{pt_id}", response_model=PaymentTypeResponse)
def update_payment_type(
    pt_id: int,
    payment_type: PaymentTypeUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_module("payment_types", "edit")),
):
    db_pt = db.query(PaymentType).filter(PaymentType.id == pt_id).first()
    if not db_pt:
        raise HTTPException(status_code=404, detail="Tipo de pagamento não encontrado")
    for key, value in payment_type.model_dump(exclude_unset=True).items():
        setattr(db_pt, key, value)
    db.commit()
    db.refresh(db_pt)
    return db_pt


@router.delete("/{pt_id}")
def delete_payment_type(
    pt_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("payment_types", "edit")),
):
    db_pt = db.query(PaymentType).filter(PaymentType.id == pt_id).first()
    if not db_pt:
        raise HTTPException(status_code=404, detail="Tipo de pagamento não encontrado")
    db_pt.is_active = False
    db.commit()
    return {"message": "Tipo de pagamento removido"}
