
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.schemas.account import AccountCreate, AccountResponse, AccountUpdate
from app.utils.security import require_module

router = APIRouter(prefix="/api/accounts", tags=["Contas e Cartões"])


@router.get("/", response_model=list[AccountResponse])
def list_accounts(
    account_type: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_module("accounts")),
):
    query = db.query(Account).filter(Account.is_active == True)
    if account_type:
        query = query.filter(Account.account_type == account_type)
    return query.all()


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("accounts")),
):
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    return acc


@router.post("/", response_model=AccountResponse)
def create_account(
    account: AccountCreate,
    db: Session = Depends(get_db),
    _=Depends(require_module("accounts", "edit")),
):
    db_acc = Account(**account.model_dump())
    db.add(db_acc)
    db.commit()
    db.refresh(db_acc)
    return db_acc


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    account: AccountUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_module("accounts", "edit")),
):
    db_acc = db.query(Account).filter(Account.id == account_id).first()
    if not db_acc:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    for key, value in account.model_dump(exclude_unset=True).items():
        setattr(db_acc, key, value)
    db.commit()
    db.refresh(db_acc)
    return db_acc


@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("accounts", "edit")),
):
    db_acc = db.query(Account).filter(Account.id == account_id).first()
    if not db_acc:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    db_acc.is_active = False
    db.commit()
    return {"message": "Conta removida"}
