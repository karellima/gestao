from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.stock import StockMovement
from app.models.user import User
from app.schemas.reports import StockMovementSummary
from app.utils.security import get_current_user, is_admin_user, require_module, user_deposit_ids
from app.utils.time import utc_now_naive

router = APIRouter()


@router.get("/stock-movements-summary", response_model=StockMovementSummary)
def get_stock_summary(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_reports")),
):
    since = utc_now_naive() - timedelta(days=days)

    mov_query = db.query(StockMovement).filter(StockMovement.created_at >= since)
    if not is_admin_user(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if not deposit_ids:
            return {"periodo_dias": days, "total_entradas": 0, "total_saidas": 0}
        mov_query = mov_query.filter(StockMovement.deposit_id.in_(deposit_ids))

    entradas = (
        mov_query.filter(StockMovement.movement_type == "entrada")
        .with_entities(func.coalesce(func.sum(StockMovement.quantity), 0)).scalar()
    )
    saidas = (
        mov_query.filter(StockMovement.movement_type == "saida")
        .with_entities(func.coalesce(func.sum(StockMovement.quantity), 0)).scalar()
    )

    return {
        "periodo_dias": days,
        "total_entradas": entradas,
        "total_saidas": saidas,
    }
