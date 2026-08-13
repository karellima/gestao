from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.stock import StockRepairReport, StockRepairRequest
from app.services.stock_repair import repair_stock
from app.utils.security import require_admin

router = APIRouter()


@router.post("/repair", response_model=StockRepairReport)
def repair(
    data: StockRepairRequest | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Reparo do estoque sob demanda — nunca no boot da aplicação.

    Simula por padrão (``dry_run=true``): devolve o relatório do que faria sem
    gravar nada. Com ``dry_run=false`` compensa as saídas de requisições nunca
    recebidas e re-sincroniza o cache ``current_stock`` a partir do histórico.
    """
    data = data or StockRepairRequest()
    return repair_stock(
        db,
        dry_run=data.dry_run,
        user_id=current_user.id,
        compensate_orphans=data.compensate_orphans,
        resync_cache=data.resync_cache,
    )
