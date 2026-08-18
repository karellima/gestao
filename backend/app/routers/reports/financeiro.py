from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.financial import Transaction
from app.schemas.reports import FinancialSummary
from app.utils.security import require_module
from app.utils.time import utc_now_naive

router = APIRouter()


@router.get("/financial-summary", response_model=FinancialSummary)
def get_financial_summary(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_module("financial_reports")),
):
    if not start_date:
        start_date = utc_now_naive().replace(day=1, hour=0, minute=0, second=0)
    if not end_date:
        end_date = utc_now_naive()

    receitas = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(Transaction.type == "receita", Transaction.date.between(start_date, end_date))
        .scalar()
    )
    despesas = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(Transaction.type == "despesa", Transaction.date.between(start_date, end_date))
        .scalar()
    )

    return {
        "periodo_inicio": start_date,
        "periodo_fim": end_date,
        "total_receitas": receitas,
        "total_despesas": despesas,
        "saldo": receitas - despesas,
    }
