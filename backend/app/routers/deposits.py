
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.deposit import Deposit
from app.models.user import User
from app.schemas.deposit import DepositCreate, DepositResponse, DepositUpdate
from app.utils.security import get_current_user, is_admin_user, require_module, user_deposit_ids

router = APIRouter(prefix="/api/deposits", tags=["Depósitos"])


def _is_admin(db: Session, user: User) -> bool:
    return is_admin_user(db, user)


@router.get("/", response_model=list[DepositResponse])
def list_deposits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("deposits")),
):
    if _is_admin(db, current_user):
        return db.query(Deposit).filter(Deposit.is_active == True).order_by(Deposit.name).all()
    deposit_ids = user_deposit_ids(current_user)
    if not deposit_ids:
        return []
    return db.query(Deposit).filter(
        Deposit.is_active == True,
        Deposit.id.in_(deposit_ids),
    ).order_by(Deposit.name).all()


@router.get("/mine", response_model=list[DepositResponse])
def list_my_deposits(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_module("deposits")),
):
    if is_admin_user(db, current_user):
        return db.query(Deposit).filter(Deposit.is_active == True).order_by(Deposit.name).all()
    deposit_ids = [d.id for d in current_user.deposits]
    children = db.query(Deposit.id).filter(
        Deposit.is_active == True,
        Deposit.parent_id.in_(deposit_ids),
    )
    all_ids = set(deposit_ids) | {c[0] for c in children}
    return db.query(Deposit).filter(
        Deposit.is_active == True,
        Deposit.id.in_(all_ids),
    ).order_by(Deposit.name).all()


@router.get("/parents", response_model=list[DepositResponse])
def list_parent_deposits(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_module("deposits")),
):
    if is_admin_user(db, current_user):
        return db.query(Deposit).filter(
            Deposit.is_active == True,
            Deposit.parent_id.is_(None),
        ).order_by(Deposit.name).all()
    deposit_ids = [d.id for d in current_user.deposits]
    return db.query(Deposit).filter(
        Deposit.is_active == True,
        Deposit.parent_id.is_(None),
        Deposit.id.in_(deposit_ids),
    ).order_by(Deposit.name).all()


@router.get("/{deposit_id}", response_model=DepositResponse)
def get_deposit(
    deposit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("deposits")),
):
    dep = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Depósito não encontrado")
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if deposit_id not in deposit_ids:
            raise HTTPException(status_code=404, detail="Depósito não encontrado")
    return dep


@router.post("/", response_model=DepositResponse)
def create_deposit(
    deposit: DepositCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_module("deposits_manage", "edit")),
):
    if deposit.parent_id:
        parent = db.query(Deposit).filter(Deposit.id == deposit.parent_id).first()
        if not parent:
            raise HTTPException(404, "Depósito pai não encontrado")
        if parent.parent_id is not None:
            raise HTTPException(400, "Não é permitido aninhar sub-depósitos (máximo 1 nível)")
    db_dep = Deposit(**deposit.model_dump())
    db.add(db_dep)
    db.commit()
    db.refresh(db_dep)
    return db_dep


@router.put("/{deposit_id}", response_model=DepositResponse)
def update_deposit(
    deposit_id: int,
    deposit: DepositUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_module("deposits_manage", "edit")),
):
    db_dep = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not db_dep:
        raise HTTPException(status_code=404, detail="Depósito não encontrado")
    if deposit.parent_id is not None and deposit.parent_id != db_dep.parent_id:
        parent = db.query(Deposit).filter(Deposit.id == deposit.parent_id).first()
        if not parent:
            raise HTTPException(404, "Depósito pai não encontrado")
        if parent.parent_id is not None:
            raise HTTPException(400, "Não é permitido aninhar sub-depósitos (máximo 1 nível)")
    for key, value in deposit.model_dump(exclude_unset=True).items():
        setattr(db_dep, key, value)
    db.commit()
    db.refresh(db_dep)
    return db_dep


@router.delete("/{deposit_id}")
def delete_deposit(
    deposit_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_module("deposits_manage", "edit")),
):
    db_dep = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not db_dep:
        raise HTTPException(status_code=404, detail="Depósito não encontrado")
    children = db.query(Deposit).filter(Deposit.parent_id == deposit_id).count()
    if children > 0:
        raise HTTPException(400, "Remova os sub-depósitos antes de remover o depósito principal")
    db_dep.is_active = False
    db.commit()
    return {"message": "Depósito removido"}
