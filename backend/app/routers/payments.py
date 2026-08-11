
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.financial import Transaction
from app.models.payment import Payment
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.utils.security import require_module

router = APIRouter(prefix="/api/payments", tags=["Pagamentos"])


def update_transaction_status(db: Session, transaction_id: int):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        return
    payments = db.query(Payment).filter(Payment.transaction_id == transaction_id).all()
    total_paid = sum(p.amount for p in payments)
    if total_paid <= 0:
        transaction.status = "pendente"
    elif total_paid < transaction.amount:
        transaction.status = "pago_parcial"
    else:
        transaction.status = "pago" if transaction.type == "despesa" else "recebido"
    db.commit()


@router.get("/by-transaction/{transaction_id}", response_model=list[PaymentResponse])
def list_payments(transaction_id: int, db: Session = Depends(get_db), _=Depends(require_module("financial"))):
    return db.query(Payment).filter(Payment.transaction_id == transaction_id).order_by(Payment.payment_date).all()


@router.post("/", response_model=PaymentResponse)
def create_payment(data: PaymentCreate, db: Session = Depends(get_db), _=Depends(require_module("financial", "edit"))):
    transaction = db.query(Transaction).filter(Transaction.id == data.transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    total_already_paid = sum(p.amount for p in db.query(Payment).filter(Payment.transaction_id == data.transaction_id).all())
    if total_already_paid + data.amount > transaction.amount:
        raise HTTPException(status_code=400, detail=f"Valor excede o saldo restante de R$ {transaction.amount - total_already_paid:.2f}")

    payment = Payment(**data.model_dump())
    db.add(payment)
    db.commit()
    db.refresh(payment)
    update_transaction_status(db, data.transaction_id)
    return payment


@router.delete("/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db), _=Depends(require_module("financial", "edit"))):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    transaction_id = payment.transaction_id
    db.delete(payment)
    db.commit()
    update_transaction_status(db, transaction_id)
    return {"detail": "Pagamento removido"}
