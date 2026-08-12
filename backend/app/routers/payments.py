
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.payment import Payment
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.financial_payments import record_payment, remove_payment
from app.utils.security import require_module

router = APIRouter(prefix="/api/payments", tags=["Pagamentos"])


@router.get("/by-transaction/{transaction_id}", response_model=list[PaymentResponse])
def list_payments(transaction_id: int, db: Session = Depends(get_db), _=Depends(require_module("financial"))):
    return db.query(Payment).filter(Payment.transaction_id == transaction_id).order_by(Payment.payment_date).all()


@router.post("/", response_model=PaymentResponse)
def create_payment(data: PaymentCreate, db: Session = Depends(get_db), _=Depends(require_module("financial", "edit"))):
    try:
        payment = record_payment(db, data)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error)) from error
    if payment is None:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db), _=Depends(require_module("financial", "edit"))):
    if not remove_payment(db, payment_id):
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    db.commit()
    return {"detail": "Pagamento removido"}
