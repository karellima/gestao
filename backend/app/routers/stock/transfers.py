from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.deposit import Deposit
from app.models.user import User
from app.schemas.stock import StockTransferCreate, TransferReportItem
from app.services.stock_ledger import transfer_stock as execute_transfer
from app.services.transfer_report import build_transfer_report
from app.utils.security import (
    get_current_user,
    is_admin_user,
    require_module,
    user_deposit_ids,
)

router = APIRouter()


def parse_utc(s: str) -> datetime:
    """Converte string ISO (com ou sem timezone/offset) em datetime naive UTC."""
    s = s.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is not None:
        dt = dt.astimezone(UTC).replace(tzinfo=None)
    return dt


@router.post("/transfer")
def transfer_stock(
    data: StockTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_movements", "edit")),
):
    if not is_admin_user(db, current_user):
        allowed = user_deposit_ids(current_user)
        if data.source_deposit_id not in allowed or data.destination_deposit_id not in allowed:
            raise HTTPException(403, "Sem acesso a este depósito")
    return execute_transfer(db, data, current_user.id)


@router.get("/transfer-report/", response_model=list[TransferReportItem])
def transfer_report(
    deposit_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_reports")),
):
    """Relatório de abastecimento, devolução, avarias e vendas por depósito."""
    query = db.query(Deposit).filter(Deposit.is_active.is_(True))
    if not is_admin_user(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if not deposit_ids:
            return []
        query = query.filter(Deposit.id.in_(deposit_ids))
    if deposit_id:
        query = query.filter(Deposit.id == deposit_id)
    start = parse_utc(start_date) if start_date else None
    end = parse_utc(end_date) if end_date else None
    return build_transfer_report(db, query.all(), start, end)
