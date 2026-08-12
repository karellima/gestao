"""Mantém pagamento, saldo da conta e status na mesma transação de banco."""

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.financial import Transaction
from app.models.payment import Payment
from app.schemas.payment import PaymentCreate

PAYMENT_TOLERANCE = 1e-6


def lock_account(db: Session, account_id: int | None) -> Account | None:
    """Serializa qualquer alteração no saldo da conta."""
    if account_id is None:
        return None
    return db.query(Account).filter(Account.id == account_id).with_for_update().first()


def lock_transaction(db: Session, transaction_id: int) -> Transaction | None:
    """Serializa pagamentos, alterações e exclusão da mesma transação."""
    return db.query(Transaction).filter(
        Transaction.id == transaction_id,
    ).with_for_update().first()


def _principal_paid(db: Session, transaction_id: int) -> float:
    return sum(
        payment.amount
        for payment in db.query(Payment).filter(
            Payment.transaction_id == transaction_id,
        ).all()
    )


def _cash_amount(payment: Payment) -> float:
    return payment.amount + (payment.interest or 0)


def _change_account_balance(
    account: Account | None,
    transaction_type: str,
    cash_amount: float,
) -> None:
    if account is None:
        return
    direction = -1 if transaction_type == "despesa" else 1
    account.balance = round((account.balance or 0) + direction * cash_amount, 2)


def sync_transaction_status(db: Session, transaction: Transaction) -> None:
    """Deriva o status do principal já pago, sem considerar juros."""
    total_paid = _principal_paid(db, transaction.id)
    if total_paid <= PAYMENT_TOLERANCE:
        transaction.status = "pendente"
    elif transaction.amount - total_paid > PAYMENT_TOLERANCE:
        transaction.status = "pago_parcial"
    else:
        transaction.status = "pago" if transaction.type == "despesa" else "recebido"


def apply_transaction_updates(
    db: Session,
    transaction: Transaction,
    updates: dict,
) -> None:
    """Aplica alterações que preservam o efeito financeiro já registrado."""
    paid_total = _principal_paid(db, transaction.id)
    account_changes = (
        "account_id" in updates and updates["account_id"] != transaction.account_id
    )
    type_changes = "type" in updates and updates["type"] != transaction.type
    if paid_total > 0 and (account_changes or type_changes):
        raise ValueError("Conta e tipo não podem mudar após registrar pagamento")
    if "amount" in updates and updates["amount"] + PAYMENT_TOLERANCE < paid_total:
        raise ValueError("Valor não pode ser menor que o total já pago")
    for key, value in updates.items():
        setattr(transaction, key, value)
    sync_transaction_status(db, transaction)


def record_payment(db: Session, data: PaymentCreate) -> Payment | None:
    """Registra pagamento e seu efeito no saldo; não faz commit."""
    transaction = lock_transaction(db, data.transaction_id)
    if transaction is None:
        return None

    account = lock_account(db, transaction.account_id)
    total_already_paid = _principal_paid(db, transaction.id)
    if total_already_paid + data.amount - transaction.amount > PAYMENT_TOLERANCE:
        remaining = transaction.amount - total_already_paid
        raise ValueError(f"Valor excede o saldo restante de R$ {remaining:.2f}")

    payment_data = data.model_dump()
    payment_data["interest"] = data.interest or 0
    payment = Payment(**payment_data)
    db.add(payment)
    db.flush()
    _change_account_balance(account, transaction.type, _cash_amount(payment))
    sync_transaction_status(db, transaction)
    return payment


def remove_payment(db: Session, payment_id: int) -> bool:
    """Remove pagamento e desfaz saldo/status; não faz commit."""
    transaction_id_row = db.query(Payment.transaction_id).filter(
        Payment.id == payment_id,
    ).first()
    if transaction_id_row is None:
        return False

    transaction = lock_transaction(db, transaction_id_row[0])
    if transaction is None:
        return False
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if payment is None:
        return False

    account = lock_account(db, transaction.account_id)
    _change_account_balance(account, transaction.type, -_cash_amount(payment))
    db.delete(payment)
    db.flush()
    sync_transaction_status(db, transaction)
    return True


def remove_transaction(db: Session, transaction_id: int) -> bool:
    """Exclui a transação e desfaz na conta todos os pagamentos; não faz commit."""
    transaction = lock_transaction(db, transaction_id)
    if transaction is None:
        return False

    account = lock_account(db, transaction.account_id)
    payments = db.query(Payment).filter(
        Payment.transaction_id == transaction_id,
    ).with_for_update().all()
    cash_total = sum(_cash_amount(payment) for payment in payments)
    _change_account_balance(account, transaction.type, -cash_total)
    for payment in payments:
        db.delete(payment)
    db.delete(transaction)
    db.flush()
    return True
