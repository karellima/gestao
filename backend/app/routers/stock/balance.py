from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.stock import StockBalanceItem, StockMovementReportItem
from app.services.stock_reports import build_stock_balance, build_stock_movement_report
from app.utils.security import (
    get_current_user,
    is_admin_user,
    require_any_module,
    require_module,
    user_deposit_ids,
)

router = APIRouter()


def _allowed_deposit_ids(db: Session, current_user: User) -> list[int] | None:
    if is_admin_user(db, current_user):
        return None
    return user_deposit_ids(current_user)


def _parse_period(
    start_date: str | None,
    end_date: str | None,
) -> tuple[datetime | None, datetime | None]:
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date + "T23:59:59") if end_date else None
    return start, end


@router.get("/balance/", response_model=list[StockBalanceItem])
def stock_balance(
    deposit_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_module(["stock_reports", "deposits"])),
):
    allowed_deposit_ids = _allowed_deposit_ids(db, current_user)
    if allowed_deposit_ids == []:
        return []
    start, end = _parse_period(start_date, end_date)
    return build_stock_balance(
        db,
        deposit_id,
        start,
        end,
        allowed_deposit_ids,
    )


@router.get("/report/", response_model=list[StockMovementReportItem])
def stock_movement_report(
    deposit_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_reports")),
):
    allowed_deposit_ids = _allowed_deposit_ids(db, current_user)
    if allowed_deposit_ids == []:
        return []
    start, end = _parse_period(start_date, end_date)
    return build_stock_movement_report(
        db,
        deposit_id,
        start,
        end,
        allowed_deposit_ids,
    )
