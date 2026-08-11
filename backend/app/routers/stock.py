from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Optional
from datetime import datetime, timezone
from app.database import get_db
from app.models.stock import StockMovement
from app.models.product import Product
from app.models.deposit import Deposit
from app.models.user import User
from app.schemas.stock import (
    StockMovementCreate, StockMovementUpdate, StockMovementResponse,
    StockBalanceItem, StockMovementReportItem, StockTransferCreate,
    StockAvariaCreate, TransferReportItem, StockRepairRequest, StockRepairReport,
)
from app.utils.security import (
    get_current_user, require_module, require_any_module, require_admin,
    is_admin_user, user_deposit_ids,
)
from app.utils.helpers import product_label
from app.services.stock_ledger import (
    SOURCE_ESTORNO, SOURCE_REPARO,
    compensate_movement, is_compensated, recalculate_product_stock,
)
from app.services.stock_repair import repair_stock

router = APIRouter(prefix="/api/stock", tags=["Estoque"])


def _is_admin(db: Session, user: User) -> bool:
    return is_admin_user(db, user)


def parse_utc(s: str) -> datetime:
    """Converte string ISO (com ou sem timezone/offset) em datetime naive UTC."""
    s = s.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@router.get("/movements/", response_model=List[StockMovementResponse])
def list_movements(
    skip: int = 0,
    limit: int = 200,
    product_id: Optional[int] = None,
    deposit_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_movements")),
):
    query = db.query(StockMovement)
    if not _is_admin(db, current_user):
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
    if not _is_admin(db, current_user) and movement.deposit_id not in user_deposit_ids(current_user):
        raise HTTPException(status_code=403, detail="Sem acesso a este depósito")
    product = db.query(Product).filter(Product.id == movement.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    deposit = db.query(Deposit).filter(Deposit.id == movement.deposit_id).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Depósito não encontrado")

    if movement.movement_type == "saida" and not movement.reason:
        raise HTTPException(status_code=400, detail="Requisição de saída deve informar o motivo/destino")

    movement_date = None
    if movement.movement_date:
        movement_date = datetime.fromisoformat(movement.movement_date)
    else:
        movement_date = datetime.utcnow()

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
    db.commit()
    db.refresh(db_movement)
    recalculate_product_stock(db, movement.product_id)
    return db_movement


def _load_correctable_movement(db: Session, movement_id: int, verbo: str) -> StockMovement:
    """Busca a movimentação e recusa as que não podem receber correção."""
    db_movement = db.query(StockMovement).filter(StockMovement.id == movement_id).first()
    if not db_movement:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    if db_movement.source == "requisicao":
        raise HTTPException(
            status_code=400,
            detail=f"Movimentação gerada por requisição não pode ser {verbo}",
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
    if not _is_admin(db, current_user) and db_movement.deposit_id not in user_deposit_ids(current_user):
        raise HTTPException(status_code=403, detail="Sem acesso a este depósito")

    data = movement.model_dump(exclude_unset=True)

    if data.get("product_id") is not None:
        if not db.query(Product).filter(Product.id == data["product_id"]).first():
            raise HTTPException(status_code=404, detail="Produto não encontrado")
    if data.get("deposit_id") is not None:
        if not db.query(Deposit).filter(Deposit.id == data["deposit_id"]).first():
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
    db.commit()
    db.refresh(corrected)

    recalculate_product_stock(db, old_product_id)
    if new_product_id != old_product_id:
        recalculate_product_stock(db, new_product_id)
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
    if not _is_admin(db, current_user) and db_movement.deposit_id not in user_deposit_ids(current_user):
        raise HTTPException(status_code=403, detail="Sem acesso a este depósito")
    product_id = db_movement.product_id

    compensation = compensate_movement(
        db, db_movement,
        user_id=current_user.id,
        notes=f"Estorno solicitado da movimentação #{db_movement.id}",
    )
    db.commit()
    db.refresh(compensation)

    recalculate_product_stock(db, product_id)
    return {
        "message": "Movimentação estornada",
        "movement_id": movement_id,
        "compensation_id": compensation.id,
    }


@router.post("/repair", response_model=StockRepairReport)
def repair(
    data: Optional[StockRepairRequest] = None,
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


@router.get("/balance/", response_model=List[StockBalanceItem])
def stock_balance(
    deposit_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_module(["stock_reports", "deposits"])),
):
    query = (
        db.query(StockMovement, Product.cost_price, Product.price)
        .join(Product, Product.id == StockMovement.product_id)
    )

    if not _is_admin(db, current_user):
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

    rows = query.all()

    products = {}
    for movement, cost_price, product_price in rows:
        pid = movement.product_id
        if pid not in products:
            products[pid] = {
                "product_id": pid,
                "product_name": product_label(movement.product),
                "unit_abbr": movement.product.unit.abbreviation if movement.product.unit else "",
                "quantity_entries": 0,
                "quantity_exits": 0,
                "total_value_entries": 0.0,
                "total_value_exits": 0.0,
            }

        p = products[pid]

        if movement.movement_type == "entrada":
            # Devolução dos filhos entra como Entrada no PAI (espelhando a saída do filho)
            p["quantity_entries"] += movement.quantity
            effective_price = movement.unit_price
            if not effective_price or effective_price == 0:
                effective_price = cost_price or product_price or 0
            p["total_value_entries"] += movement.quantity * effective_price
        else:
            p["quantity_exits"] += movement.quantity
            p["total_value_exits"] += movement.total_value or 0

    sorted_products = sorted(products.values(), key=lambda x: x["product_name"])

    return [
        StockBalanceItem(
            product_id=p["product_id"],
            product_name=p["product_name"],
            unit_abbr=p["unit_abbr"],
            quantity_entries=p["quantity_entries"],
            quantity_exits=p["quantity_exits"],
            balance=p["quantity_entries"] - p["quantity_exits"],
            total_value_entries=p["total_value_entries"],
            total_value_exits=p["total_value_exits"],
        )
        for p in sorted_products
    ]


@router.get("/report/", response_model=List[StockMovementReportItem])
def stock_movement_report(
    deposit_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_reports")),
):
    query = (
        db.query(StockMovement, Product.cost_price, Product.price)
        .join(Product, Product.id == StockMovement.product_id)
        .join(Deposit, Deposit.id == StockMovement.deposit_id)
    )
    if not _is_admin(db, current_user):
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

    rows = query.order_by(StockMovement.movement_date.desc()).all()

    return [
        StockMovementReportItem(
            id=m.id,
            product_id=m.product_id,
            product_name=product_label(m.product),
            deposit_id=m.deposit_id,
            deposit_name=m.deposit.name,
            movement_type=m.movement_type,
            movement_date=m.movement_date,
            quantity=m.quantity,
            unit_price=m.unit_price if (m.unit_price and m.unit_price > 0) else (cost_price or product_price or 0),
            total_value=m.total_value if (m.unit_price and m.unit_price > 0) else (m.quantity * (cost_price or product_price or 0)),
            reason=m.reason,
            created_at=m.created_at,
        )
        for m, cost_price, product_price in rows
    ]


@router.post("/transfer")
def transfer_stock(
    data: StockTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_movements", "edit")),
):
    if not _is_admin(db, current_user):
        allowed = user_deposit_ids(current_user)
        if data.source_deposit_id not in allowed or data.destination_deposit_id not in allowed:
            raise HTTPException(403, "Sem acesso a este depósito")
    if data.source_deposit_id == data.destination_deposit_id:
        raise HTTPException(400, "Depósitos de origem e destino devem ser diferentes")
    src = db.query(Deposit).filter(Deposit.id == data.source_deposit_id).first()
    if not src:
        raise HTTPException(404, "Depósito de origem não encontrado")
    dst = db.query(Deposit).filter(Deposit.id == data.destination_deposit_id).first()
    if not dst:
        raise HTTPException(404, "Depósito de destino não encontrado")
    if data.transfer_type not in ("abastecimento", "devolucao"):
        raise HTTPException(400, "Tipo deve ser 'abastecimento' ou 'devolucao'")

    type_label = "Abastecimento" if data.transfer_type == "abastecimento" else "Devolução"
    for it in data.items:
        product = db.query(Product).filter(Product.id == it.product_id).first()
        if not product:
            raise HTTPException(404, f"Produto {it.product_id} não encontrado")
        if it.quantity <= 0:
            raise HTTPException(400, f"Quantidade inválida para produto {it.product_id}")

        available = db.query(func.coalesce(func.sum(
            case(
                (StockMovement.movement_type == "entrada", StockMovement.quantity),
                else_=-StockMovement.quantity,
            )
        ), 0)).filter(
            StockMovement.product_id == it.product_id,
            StockMovement.deposit_id == data.source_deposit_id,
        ).scalar()
        if it.quantity > available:
            raise HTTPException(
                400,
                f"Saldo insuficiente de {product.name} no depósito {src.name}: disponível {available}",
            )

        unit_price = it.unit_price or product.cost_price or product.price or 0

        # Saída da origem
        mov_out = StockMovement(
            product_id=it.product_id,
            deposit_id=data.source_deposit_id,
            movement_type="saida",
            quantity=it.quantity,
            unit_price=unit_price,
            total_value=it.quantity * unit_price,
            reason=f"Transferência: {type_label} → {dst.name}",
            user_id=current_user.id,
        )
        db.add(mov_out)

        # Entrada no destino
        mov_in = StockMovement(
            product_id=it.product_id,
            deposit_id=data.destination_deposit_id,
            movement_type="entrada",
            quantity=it.quantity,
            unit_price=unit_price,
            total_value=it.quantity * unit_price,
            reason=f"Transferência: {type_label} ← {src.name}",
            user_id=current_user.id,
        )
        db.add(mov_in)

        recalculate_product_stock(db, it.product_id)

    db.commit()
    return {"message": f"{type_label} realizado com sucesso", "items_count": len(data.items)}


@router.post("/avaria")
def register_avaria(
    data: StockAvariaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_movements", "edit")),
):
    if not _is_admin(db, current_user) and data.deposit_id not in user_deposit_ids(current_user):
        raise HTTPException(403, "Sem acesso a este depósito")
    deposit = db.query(Deposit).filter(Deposit.id == data.deposit_id).first()
    if not deposit:
        raise HTTPException(404, "Depósito não encontrado")
    if not data.items:
        raise HTTPException(400, "Adicione pelo menos um item")

    # Build set of deposit IDs for stock validation (deposit + parent, or parent + children)
    validate_ids = {data.deposit_id}
    if deposit.parent_id:
        validate_ids.add(deposit.parent_id)
    else:
        for c in deposit.children:
            validate_ids.add(c.id)

    for it in data.items:
        product = db.query(Product).filter(Product.id == it.product_id).first()
        if not product:
            raise HTTPException(404, f"Produto {it.product_id} não encontrado")
        if it.quantity <= 0:
            raise HTTPException(400, f"Quantidade inválida para produto {it.product_id}")

        # Validate stock: sum of entradas - saidas across related deposits
        entrada = db.query(func.coalesce(func.sum(StockMovement.quantity), 0)).filter(
            StockMovement.product_id == it.product_id,
            StockMovement.deposit_id.in_(validate_ids),
            StockMovement.movement_type == "entrada",
        ).scalar()
        saida = db.query(func.coalesce(func.sum(StockMovement.quantity), 0)).filter(
            StockMovement.product_id == it.product_id,
            StockMovement.deposit_id.in_(validate_ids),
            StockMovement.movement_type == "saida",
        ).scalar()
        available = entrada - saida
        if it.quantity > available:
            raise HTTPException(400, f"Avariado para '{product.name}' ({it.quantity} und) excede o estoque disponível ({available} und)")

        unit_price = it.unit_price or product.cost_price or product.price or 0
        mov = StockMovement(
            product_id=it.product_id,
            deposit_id=data.deposit_id,
            movement_type="saida",
            quantity=it.quantity,
            unit_price=unit_price,
            total_value=it.quantity * unit_price,
            reason=f"Avaria: {data.description}",
            user_id=current_user.id,
        )
        db.add(mov)
        recalculate_product_stock(db, it.product_id)

    db.commit()
    return {"message": "Avaria registrada com sucesso", "items_count": len(data.items)}


@router.get("/avarias/", response_model=List[StockMovementResponse])
def list_avarias(
    deposit_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_movements")),
):
    query = db.query(StockMovement).filter(
        StockMovement.movement_type == "saida",
        StockMovement.reason.like("Avaria:%"),
    )
    if not _is_admin(db, current_user):
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


@router.get("/transfer-report/", response_model=List[TransferReportItem])
def transfer_report(
    deposit_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("stock_reports")),
):
    """
    Relatório de abastecimento vs devolução vs avarias vs vendas por depósito.
    Para sub-depósitos, abastecimento = o que recebeu do pai; para depósitos pai,
    abastecimento = o que enviou aos filhos. Venda = abastecimento - devolução - avaria.
    """
    query = db.query(Deposit).filter(Deposit.is_active == True)
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if not deposit_ids:
            return []
        query = query.filter(Deposit.id.in_(deposit_ids))
    if deposit_id:
        query = query.filter(Deposit.id == deposit_id)
    deposits = query.all()

    def apply_dates(q):
        if start_date:
            q = q.filter(StockMovement.movement_date >= parse_utc(start_date))
        if end_date:
            q = q.filter(StockMovement.movement_date <= parse_utc(end_date))
        return q

    result = []

    for dep in deposits:
        is_parent = not dep.parent_id
        parent_name = None
        if not is_parent:
            parent = db.query(Deposit).filter(Deposit.id == dep.parent_id).first()
            parent_name = parent.name if parent else "?"

        if is_parent:
            # Pai: abastecimento = o que enviou aos filhos (saídas)
            ab_query = db.query(
                StockMovement.product_id,
                func.sum(StockMovement.quantity).label("total_qty"),
                func.avg(StockMovement.unit_price).label("avg_price"),
            ).filter(
                StockMovement.deposit_id == dep.id,
                StockMovement.movement_type == "saida",
                StockMovement.reason.like("%Abastecimento%"),
            )
            # Devolução = o que recebeu de volta dos filhos (entradas)
            dev_query = db.query(
                StockMovement.product_id,
                func.sum(StockMovement.quantity).label("total_qty"),
                func.avg(StockMovement.unit_price).label("avg_price"),
            ).filter(
                StockMovement.deposit_id == dep.id,
                StockMovement.movement_type == "entrada",
                StockMovement.reason.like("%Devolução%"),
            )
        else:
            # Sub-depósito: abastecimento = o que recebeu do pai (entradas)
            ab_query = db.query(
                StockMovement.product_id,
                func.sum(StockMovement.quantity).label("total_qty"),
                func.avg(StockMovement.unit_price).label("avg_price"),
            ).filter(
                StockMovement.deposit_id == dep.id,
                StockMovement.movement_type == "entrada",
                StockMovement.reason.like(f"%Abastecimento%{parent_name}%"),
            )
            # Devolução = o que devolveu ao pai (saídas)
            dev_query = db.query(
                StockMovement.product_id,
                func.sum(StockMovement.quantity).label("total_qty"),
                func.avg(StockMovement.unit_price).label("avg_price"),
            ).filter(
                StockMovement.deposit_id == dep.id,
                StockMovement.movement_type == "saida",
                StockMovement.reason.like("%Devolução%"),
            )

        av_query = db.query(
            StockMovement.product_id,
            func.sum(StockMovement.quantity).label("total_qty"),
        ).filter(
            StockMovement.deposit_id == dep.id,
            StockMovement.movement_type == "saida",
            StockMovement.reason.like("Avaria:%"),
        )

        abastecimento_data = {r.product_id: r for r in apply_dates(ab_query).group_by(StockMovement.product_id).all()}
        devolucao_data = {r.product_id: r for r in apply_dates(dev_query).group_by(StockMovement.product_id).all()}
        avaria_data = {r.product_id: r.total_qty for r in apply_dates(av_query).group_by(StockMovement.product_id).all()}

        all_product_ids = set(abastecimento_data.keys()) | set(devolucao_data.keys()) | set(avaria_data.keys())

        for pid in sorted(all_product_ids):
            product = db.query(Product).filter(Product.id == pid).first()
            pname = product_label(product) or f"Produto #{pid}"
            ab_qty = abastecimento_data[pid].total_qty if pid in abastecimento_data else 0
            dev_qty = devolucao_data[pid].total_qty if pid in devolucao_data else 0
            av_qty = avaria_data.get(pid, 0)
            venda_qty = ab_qty - dev_qty - av_qty
            avg_price = abastecimento_data[pid].avg_price if pid in abastecimento_data else (devolucao_data[pid].avg_price if pid in devolucao_data else 0)

            if ab_qty == 0 and dev_qty == 0 and av_qty == 0:
                continue

            result.append(TransferReportItem(
                deposit_id=dep.id,
                deposit_name=dep.name,
                product_id=pid,
                product_name=pname,
                abastecimento_qty=ab_qty,
                devolucao_qty=dev_qty,
                avaria_qty=av_qty,
                venda_qty=max(0, venda_qty),
                unit_price=avg_price or 0,
                venda_total=max(0, venda_qty) * (avg_price or 0),
            ))

    return result
