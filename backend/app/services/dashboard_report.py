from calendar import monthrange
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.contact import Contact
from app.models.financial import Transaction
from app.models.financial_category import FinancialCategory
from app.models.product import Product
from app.models.user import User
from app.utils.security import is_admin_user, user_deposit_ids
from app.utils.time import naive_utc, utc_now_naive


def _product_counts(db: Session, current_user: User) -> tuple[int, int, int]:
    product_query = db.query(Product).filter(Product.is_active.is_(True))
    if not is_admin_user(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if deposit_ids:
            product_query = product_query.filter(Product.deposit_id.in_(deposit_ids))
        else:
            product_query = product_query.filter(False)

    return (
        product_query.count(),
        product_query.filter(Product.current_stock <= Product.min_stock).count(),
        db.query(Contact).filter(Contact.is_active.is_(True)).count(),
    )


def _month_window(now: datetime) -> tuple[datetime, datetime, datetime, datetime]:
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today_start.replace(day=1)
    month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    next_7 = today_start + timedelta(days=7)
    return today_start, month_start, month_end, next_7


def _month_pending(query, month_start: datetime, month_end: datetime):
    return query.filter(
        Transaction.status.in_(["pendente", "pago_parcial"]),
        Transaction.due_date >= month_start,
        Transaction.due_date < month_end,
    )


def _monthly_totals(
    db: Session,
    month_start: datetime,
    month_end: datetime,
) -> dict:
    receitas = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(Transaction.type == "receita", Transaction.date >= month_start, Transaction.date < month_end)
        .scalar()
    )
    despesas = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(Transaction.type == "despesa", Transaction.date >= month_start, Transaction.date < month_end)
        .scalar()
    )
    a_pagar = (
        _month_pending(db.query(func.coalesce(func.sum(Transaction.amount), 0)), month_start, month_end)
        .filter(Transaction.type == "despesa")
        .scalar()
    )
    a_receber = (
        _month_pending(db.query(func.coalesce(func.sum(Transaction.amount), 0)), month_start, month_end)
        .filter(Transaction.type == "receita")
        .scalar()
    )
    qtd_pendentes = _month_pending(
        db.query(func.count(Transaction.id)), month_start, month_end
    ).scalar()
    return {
        "receitas": receitas,
        "despesas": despesas,
        "a_pagar": a_pagar,
        "a_receber": a_receber,
        "qtd_pendentes": qtd_pendentes,
    }


def _serialize_txn(transaction: Transaction) -> dict:
    return {
        "id": transaction.id,
        "description": transaction.description,
        "amount": transaction.amount,
        "type": transaction.type,
        "due_date": transaction.due_date.isoformat() if transaction.due_date else None,
        "contact": transaction.contact.name if transaction.contact else None,
    }


def _transaction_query(db: Session):
    return db.query(Transaction).options(
        joinedload(Transaction.financial_category),
        joinedload(Transaction.contact),
    )


def _pending_lists(
    db: Session,
    month_start: datetime,
    month_end: datetime,
) -> tuple[list[dict], list[dict]]:
    a_pagar_list = [
        _serialize_txn(transaction)
        for transaction in _month_pending(_transaction_query(db), month_start, month_end)
        .filter(Transaction.type == "despesa")
        .order_by(Transaction.due_date.asc())
        .all()
    ]
    a_receber_list = [
        _serialize_txn(transaction)
        for transaction in _month_pending(_transaction_query(db), month_start, month_end)
        .filter(Transaction.type == "receita")
        .order_by(Transaction.due_date.asc())
        .all()
    ]
    return a_pagar_list, a_receber_list


def _category_totals(db: Session, month_start: datetime) -> tuple[dict, dict]:
    # Agrupamento por categoria
    despesas = (
        db.query(FinancialCategory.name, func.sum(Transaction.amount))
        .join(Transaction, Transaction.financial_category_id == FinancialCategory.id)
        .filter(Transaction.type == "despesa", Transaction.date >= month_start)
        .group_by(FinancialCategory.name)
        .all()
    )
    receitas = (
        db.query(FinancialCategory.name, func.sum(Transaction.amount))
        .join(Transaction, Transaction.financial_category_id == FinancialCategory.id)
        .filter(Transaction.type == "receita", Transaction.date >= month_start)
        .group_by(FinancialCategory.name)
        .all()
    )
    return dict(despesas), dict(receitas)


def _base_overdue(query, today_start: datetime):
    return query.filter(
        Transaction.due_date < today_start,
        ~Transaction.status.in_(["pago", "recebido"]),
    )


def _overdue_stats(db: Session, tipo: str, today_start: datetime) -> dict:
    total = (
        _base_overdue(db.query(func.coalesce(func.sum(Transaction.amount), 0)), today_start)
        .filter(Transaction.type == tipo)
        .scalar()
    )
    count = (
        _base_overdue(db.query(func.count(Transaction.id)), today_start)
        .filter(Transaction.type == tipo)
        .scalar()
    )
    items = (
        _base_overdue(_transaction_query(db), today_start)
        .filter(Transaction.type == tipo)
        .order_by(Transaction.due_date.asc())
        .all()
    )
    return {
        "count": count,
        "total": total,
        "list": [_serialize_txn(transaction) for transaction in items],
    }


def _next_due_stats(
    db: Session,
    tipo: str,
    today_start: datetime,
    next_7: datetime,
) -> dict:
    query = _transaction_query(db).filter(
        Transaction.due_date >= today_start,
        Transaction.due_date <= next_7,
        ~Transaction.status.in_(["pago", "recebido"]),
        Transaction.type == tipo,
    )
    return {
        "count": query.count(),
        "total": query.with_entities(func.coalesce(func.sum(Transaction.amount), 0)).scalar(),
        "list": [_serialize_txn(transaction) for transaction in query.order_by(Transaction.due_date.asc()).all()],
    }


def _recent_transactions(db: Session) -> list[dict]:
    recent = (
        _transaction_query(db)
        .order_by(Transaction.created_at.desc())
        .limit(5)
        .all()
    )
    return [
        {
            "id": transaction.id,
            "description": transaction.description,
            "amount": transaction.amount,
            "type": transaction.type,
            "status": transaction.status,
            "date": transaction.date.isoformat() if transaction.date else None,
            "category": transaction.financial_category.name if transaction.financial_category else None,
            "contact": transaction.contact.name if transaction.contact else None,
        }
        for transaction in recent
    ]


def _monthly_evolution(db: Session, month_start: datetime) -> list[dict]:
    # Evolução mensal (últimos 6 meses)
    monthly_evolution = []
    for i in range(5, -1, -1):
        m = month_start.month - i
        y = month_start.year
        while m < 1:
            m += 12
            y -= 1
        while m > 12:
            m -= 12
            y += 1
        _, last_day = monthrange(y, m)
        m_start = naive_utc(y, m, 1)
        m_end = naive_utc(y, m, last_day).replace(hour=23, minute=59, second=59)
        m_rec = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(Transaction.type == "receita", Transaction.date.between(m_start, m_end))
            .scalar()
        )
        m_desp = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(Transaction.type == "despesa", Transaction.date.between(m_start, m_end))
            .scalar()
        )
        monthly_evolution.append({
            "mes": f"{y}-{m:02d}",
            "receitas": m_rec,
            "despesas": m_desp,
        })
    return monthly_evolution


def build_dashboard(db: Session, current_user: User) -> dict:
    total_products, low_stock, total_contacts = _product_counts(db, current_user)
    today_start, month_start, month_end, next_7 = _month_window(utc_now_naive())
    monthly = _monthly_totals(db, month_start, month_end)
    a_pagar_list, a_receber_list = _pending_lists(db, month_start, month_end)
    despesas_cat, receitas_cat = _category_totals(db, month_start)
    overdue_pagar = _overdue_stats(db, "despesa", today_start)
    overdue_receber = _overdue_stats(db, "receita", today_start)
    next_pagar = _next_due_stats(db, "despesa", today_start, next_7)
    next_receber = _next_due_stats(db, "receita", today_start, next_7)
    recent_transactions = _recent_transactions(db)
    monthly_evolution = _monthly_evolution(db, month_start)

    return {
        "total_products": total_products,
        "low_stock_products": low_stock,
        "total_contacts": total_contacts,
        "monthly_receitas": monthly["receitas"],
        "monthly_despesas": monthly["despesas"],
        "monthly_balance": monthly["receitas"] - monthly["despesas"],
        "a_pagar": monthly["a_pagar"],
        "a_receber": monthly["a_receber"],
        "qtd_pendentes": monthly["qtd_pendentes"],
        "a_pagar_list": a_pagar_list,
        "a_receber_list": a_receber_list,
        "despesas_por_categoria": despesas_cat,
        "receitas_por_categoria": receitas_cat,
        "overdue_pagar": overdue_pagar,
        "overdue_receber": overdue_receber,
        "next_pagar": next_pagar,
        "next_receber": next_receber,
        "next_due_total": next_pagar["total"] + next_receber["total"],
        "next_due_count": next_pagar["count"] + next_receber["count"],
        "next_due_list": next_pagar["list"] + next_receber["list"],
        "recent_transactions": recent_transactions,
        "monthly_evolution": monthly_evolution,
    }
