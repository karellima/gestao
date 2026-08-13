from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.dashboard_report import build_dashboard
from app.utils.security import get_current_user, require_module

router = APIRouter()


@router.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("dashboard")),
):
    return build_dashboard(db, current_user)
