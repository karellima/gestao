from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.stock import StockMovement
from app.models.user import User
from app.schemas.stock import StockAvariaCreate, StockMovementResponse
from app.services.stock_ledger import register_avaria as execute_avaria
from app.utils.security import (
    get_current_user,
    is_admin_user,
    require_module,
    user_deposit_ids,
)

router = APIRouter()


@router.post("/avaria")
def register_avaria(
    data: StockAvariaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_movements", "edit")),
):
    if not is_admin_user(db, current_user) and data.deposit_id not in user_deposit_ids(current_user):
        raise HTTPException(403, "Sem acesso a este depósito")
    return execute_avaria(db, data, current_user.id)


@router.get("/avarias/", response_model=list[StockMovementResponse])
def list_avarias(
    deposit_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_movements")),
):
    query = db.query(StockMovement).filter(
        StockMovement.movement_type == "saida",
        StockMovement.reason.like("Avaria:%"),
    )
    if not is_admin_user(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if not deposit_ids:
            return []
        query = query.filter(StockMovement.deposit_id.in_(deposit_ids))
    if deposit_id:
        query = query.filter(StockMovement.deposit_id == deposit_id)
    if start_date:
        start = datetime.fromisoformat(start_date)
        query = query.filter(StockMovement.movement_date >= start)
    if end_date:
        end = datetime.fromisoformat(end_date + "T23:59:59")
        query = query.filter(StockMovement.movement_date <= end)
    return query.order_by(StockMovement.movement_date.desc()).all()
