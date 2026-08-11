from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.financial import Transaction
from app.schemas.financial import TransactionCreate, TransactionResponse, TransactionUpdate
from app.utils.security import get_current_user, require_module

router = APIRouter(prefix="/api/financial", tags=["Financeiro"])


@router.get("/transactions/", response_model=list[TransactionResponse])
def list_transactions(
    skip: int = 0,
    limit: int = 100,
    type: str = None,
    status: str = None,
    start_date: datetime = None,
    end_date: datetime = None,
    due_date_start: datetime | None = None,
    due_date_end: datetime | None = None,
    contact_id: int = None,
    db: Session = Depends(get_db),
    _=Depends(require_module("financial")),
):
    query = db.query(Transaction)
    if type:
        query = query.filter(Transaction.type == type)
    if status:
        query = query.filter(Transaction.status == status)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if due_date_start:
        query = query.filter(Transaction.due_date >= due_date_start)
    if due_date_end:
        query = query.filter(Transaction.due_date <= due_date_end)
    if contact_id:
        query = query.filter(Transaction.contact_id == contact_id)
    return query.order_by(Transaction.date.desc()).offset(skip).limit(limit).all()


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("financial")),
):
    t = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return t


@router.post("/transactions/", response_model=TransactionResponse)
def create_transaction(
    transaction: TransactionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_module("financial", "edit")),
):
    db_transaction = Transaction(**transaction.model_dump(), user_id=current_user.id)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


@router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    transaction: TransactionUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_module("financial", "edit")),
):
    db_transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    for key, value in transaction.model_dump(exclude_unset=True).items():
        setattr(db_transaction, key, value)

    db.commit()
    db.refresh(db_transaction)
    return db_transaction


@router.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("financial", "edit")),
):
    db_transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    db.delete(db_transaction)
    db.commit()
    return {"message": "Transação removida"}
