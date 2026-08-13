from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.deposit import Deposit
from app.models.product import Product
from app.models.stock import StockMovement
from app.models.user import User
from app.schemas.stock import (
    StockMovementCreate,
    StockMovementResponse,
    StockMovementUpdate,
)
from app.services.stock_ledger import (
    SOURCE_ESTORNO,
    SOURCE_REPARO,
    compensate_movement,
    is_compensated,
    lock_stock_products,
    recalculate_product_stock,
)
from app.utils.security import (
    get_current_user,
    is_admin_user,
    require_module,
    user_deposit_ids,
)
from app.utils.time import utc_now_naive

router = APIRouter()


@router.get("/movements/", response_model=list[StockMovementResponse])
def list_movements(
    skip: int = 0,
    limit: int = 200,
    product_id: int | None = None,
    deposit_id: int | None = None,
    movement_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_movements")),
):
    query = db.query(StockMovement)
    if not is_admin_user(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if not deposit_ids:
            return []
        query = query.filter(StockMovement.deposit_id.in_(deposit_ids))
    if deposit_id:
        query = query.filter(StockMovement.deposit_id == deposit_id)
    if product_id:
        query = query.filter(StockMovement.product_id == product_id)
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)
    if start_date:
        start = datetime.fromisoformat(start_date)
        query = query.filter(StockMovement.movement_date >= start)
    if end_date:
        end = datetime.fromisoformat(end_date + "T23:59:59")
        query = query.filter(StockMovement.movement_date <= end)
    return query.order_by(StockMovement.movement_date.desc()).offset(skip).limit(limit).all()


@router.post("/movements/", response_model=StockMovementResponse)
def create_movement(
    movement: StockMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_movements", "edit")),
):
    if not is_admin_user(db, current_user) and movement.deposit_id not in user_deposit_ids(current_user):
        raise HTTPException(status_code=403, detail="Sem acesso a este depósito")
    product = db.query(Product).filter(Product.id == movement.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    deposit = db.query(Deposit).filter(Deposit.id == movement.deposit_id).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Depósito não encontrado")

    if movement.movement_type == "saida" and not movement.reason:
        raise HTTPException(status_code=400, detail="Requisição de saída deve informar o motivo/destino")

    lock_stock_products(db, {movement.product_id})

    movement_date = (
        datetime.fromisoformat(movement.movement_date)
        if movement.movement_date
        else utc_now_naive()
    )

    total_value = movement.quantity * movement.unit_price
    db_movement = StockMovement(
        product_id=movement.product_id,
        deposit_id=movement.deposit_id,
        movement_type=movement.movement_type,
        movement_date=movement_date,
        quantity=movement.quantity,
        unit_price=movement.unit_price,
        total_value=total_value,
        reason=movement.reason,
        notes=movement.notes,
        user_id=current_user.id,
    )
    db.add(db_movement)
    recalculate_product_stock(db, movement.product_id, commit=False)
    db.commit()
    db.refresh(db_movement)
    return db_movement


def _load_correctable_movement(
    db: Session,
    movement_id: int,
    verbo: str,
    *,
    for_update: bool = False,
) -> StockMovement:
    """Busca a movimentação e recusa as que não podem receber correção."""
    query = db.query(StockMovement).filter(StockMovement.id == movement_id)
    if for_update:
        query = query.with_for_update()
    db_movement = query.first()
    if not db_movement:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    if db_movement.source in ("requisicao", "venda"):
        origem = {"requisicao": "requisição", "venda": "venda"}[db_movement.source]
        raise HTTPException(
            status_code=400,
            detail=f"Movimentação gerada por {origem} não pode ser {verbo}",
        )
    if db_movement.source in (SOURCE_ESTORNO, SOURCE_REPARO):
        raise HTTPException(
            status_code=400,
            detail="Estorno não pode ser corrigido — corrija a movimentação seguinte",
        )
    if is_compensated(db, db_movement.id):
        raise HTTPException(
            status_code=400,
            detail="Movimentação já estornada — corrija o lançamento que a substituiu",
        )
    return db_movement


@router.put("/movements/{movement_id}", response_model=StockMovementResponse)
def update_movement(
    movement_id: int,
    movement: StockMovementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_movements", "edit")),
):
    """Corrige uma movimentação sem reescrevê-la.

    O lançamento original fica onde está. Grava-se o estorno dele e, em
    seguida, o lançamento corrigido — três linhas no extrato, saldo certo, e
    dá para saber depois o que foi lançado errado, quando e por quem.
    """
    db_movement = _load_correctable_movement(db, movement_id, "editada")
    if not is_admin_user(db, current_user) and db_movement.deposit_id not in user_deposit_ids(current_user):
        raise HTTPException(status_code=403, detail="Sem acesso a este depósito")

    data = movement.model_dump(exclude_unset=True)

    if (
        data.get("product_id") is not None
        and not db.query(Product).filter(Product.id == data["product_id"]).first()
    ):
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    if (
        data.get("deposit_id") is not None
        and not db.query(Deposit).filter(Deposit.id == data["deposit_id"]).first()
    ):
        raise HTTPException(status_code=404, detail="Depósito não encontrado")

    old_product_id = db_movement.product_id

    def corrigido(campo, padrao):
        valor = data.get(campo)
        return padrao if valor is None else valor

    new_product_id = corrigido("product_id", db_movement.product_id)
    new_quantity = corrigido("quantity", db_movement.quantity)
    new_unit_price = corrigido("unit_price", db_movement.unit_price or 0)
    new_date = db_movement.movement_date
    if data.get("movement_date"):
        new_date = datetime.fromisoformat(data["movement_date"])

    lock_stock_products(db, {old_product_id, new_product_id})
    db_movement = _load_correctable_movement(
        db, movement_id, "editada", for_update=True,
    )

    compensate_movement(
        db, db_movement,
        user_id=current_user.id,
        notes=f"Estorno automático pela correção da movimentação #{db_movement.id}",
    )

    corrected = StockMovement(
        product_id=new_product_id,
        deposit_id=corrigido("deposit_id", db_movement.deposit_id),
        movement_type=corrigido("movement_type", db_movement.movement_type),
        movement_date=new_date,
        quantity=new_quantity,
        unit_price=new_unit_price,
        total_value=new_quantity * new_unit_price,
        reason=corrigido("reason", db_movement.reason),
        notes=corrigido("notes", db_movement.notes),
        user_id=current_user.id,
    )
    db.add(corrected)
    recalculate_product_stock(db, old_product_id, commit=False)
    if new_product_id != old_product_id:
        recalculate_product_stock(db, new_product_id, commit=False)
    db.commit()
    db.refresh(corrected)
    return corrected


@router.delete("/movements/{movement_id}")
def delete_movement(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_movements", "edit")),
):
    """Anula uma movimentação por estorno — a linha original permanece.

    A rota continua sendo ``DELETE`` para não quebrar o frontend, mas nada é
    apagado: grava-se a movimentação inversa e o saldo volta ao que era.
    """
    db_movement = _load_correctable_movement(db, movement_id, "excluída")
    if not is_admin_user(db, current_user) and db_movement.deposit_id not in user_deposit_ids(current_user):
        raise HTTPException(status_code=403, detail="Sem acesso a este depósito")
    product_id = db_movement.product_id

    lock_stock_products(db, {product_id})
    db_movement = _load_correctable_movement(
        db, movement_id, "excluída", for_update=True,
    )

    compensation = compensate_movement(
        db, db_movement,
        user_id=current_user.id,
        notes=f"Estorno solicitado da movimentação #{db_movement.id}",
    )
    recalculate_product_stock(db, product_id, commit=False)
    db.commit()
    db.refresh(compensation)
    return {
        "message": "Movimentação estornada",
        "movement_id": movement_id,
        "compensation_id": compensation.id,
    }
