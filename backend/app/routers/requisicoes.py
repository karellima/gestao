
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.deposit import Deposit
from app.models.product import Product
from app.models.requisicao import Requisicao, RequisicaoItem
from app.models.stock import StockMovement
from app.models.user import User
from app.schemas.requisicao import (
    RequisicaoApprove,
    RequisicaoCreate,
    RequisicaoFulfill,
    RequisicaoItemResponse,
    RequisicaoReceive,
    RequisicaoResponse,
    RequisicaoUpdate,
)
from app.services.requisition_workflow import apply_requisicao_update
from app.services.stock_ledger import recalculate_product_stock
from app.utils.helpers import product_label
from app.utils.security import get_current_user, is_admin_user, require_module, user_deposit_ids

router = APIRouter(prefix="/api/requisicoes", tags=["Requisições de Estoque"])


def _is_admin(db: Session, user: User) -> bool:
    return is_admin_user(db, user)


def _is_requester_or_admin(db: Session, req: Requisicao, user: User) -> bool:
    if _is_admin(db, user):
        return True
    return req.requester_id == user.id


def _can_receive(db: Session, req: Requisicao, user: User) -> bool:
    if _is_admin(db, user):
        return True
    if req.requester_id == user.id:
        return True
    return req.deposit_requesting_id in user_deposit_ids(user)


def _req_to_response(r: Requisicao) -> RequisicaoResponse:
    items = [
        RequisicaoItemResponse(
            id=it.id, requisicao_id=it.requisicao_id,
            product_id=it.product_id,
            product_name=product_label(it.product),
            quantity_requested=it.quantity_requested,
            quantity_approved=it.quantity_approved,
            quantity_fulfilled=it.quantity_fulfilled or 0,
            quantity_received=it.quantity_received or 0,
            unit_price=it.unit_price,
        )
        for it in r.items
    ]
    return RequisicaoResponse(
        id=r.id,
        requester_id=r.requester_id,
        requester_name=r.requester.name if r.requester else None,
        approver_id=r.approver_id,
        approver_name=r.approver.name if r.approver else None,
        deposit_requesting_id=r.deposit_requesting_id,
        deposit_requesting_name=r.deposit_requesting.name if r.deposit_requesting else None,
        deposit_fulfilling_id=r.deposit_fulfilling_id,
        deposit_fulfilling_name=r.deposit_fulfilling.name if r.deposit_fulfilling else None,
        status=r.status,
        reason=r.reason,
        notes=r.notes,
        created_at=r.created_at,
        updated_at=r.updated_at,
        items=items,
    )


@router.get("/", response_model=list[RequisicaoResponse])
def list_requisicoes(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes")),
):
    query = db.query(Requisicao).options(
        joinedload(Requisicao.requester),
        joinedload(Requisicao.approver),
        joinedload(Requisicao.deposit_requesting),
        joinedload(Requisicao.deposit_fulfilling),
        joinedload(Requisicao.items).joinedload(RequisicaoItem.product),
    )
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        query = query.filter(or_(
            Requisicao.requester_id == current_user.id,
            Requisicao.deposit_requesting_id.in_(deposit_ids),
            and_(
                Requisicao.deposit_fulfilling_id.in_(deposit_ids),
                Requisicao.status != "pendente",
            ),
        ))
    if status:
        query = query.filter(Requisicao.status == status)
    query = query.order_by(Requisicao.created_at.desc())
    return [_req_to_response(r) for r in query.all()]


@router.post("/", response_model=RequisicaoResponse, status_code=201)
def create_requisicao(
    data: RequisicaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    if not data.items:
        raise HTTPException(400, "Adicione pelo menos um item")

    dep_req = db.query(Deposit).filter(Deposit.id == data.deposit_requesting_id).first()
    if not dep_req:
        raise HTTPException(404, "Depósito solicitante não encontrado")
    dep_ful = db.query(Deposit).filter(Deposit.id == data.deposit_fulfilling_id).first()
    if not dep_ful:
        raise HTTPException(404, "Depósito de atendimento não encontrado")

    for it in data.items:
        if not db.query(Product).filter(Product.id == it.product_id).first():
            raise HTTPException(404, f"Produto {it.product_id} não encontrado")

    req = Requisicao(
        requester_id=current_user.id,
        deposit_requesting_id=data.deposit_requesting_id,
        deposit_fulfilling_id=data.deposit_fulfilling_id,
        reason=data.reason,
        notes=data.notes,
    )
    db.add(req)
    db.flush()

    for it in data.items:
        db.add(RequisicaoItem(
            requisicao_id=req.id,
            product_id=it.product_id,
            quantity_requested=it.quantity_requested,
            unit_price=it.unit_price,
        ))

    db.commit()
    db.refresh(req)
    # reload with joins
    req = db.query(Requisicao).options(
        joinedload(Requisicao.requester),
        joinedload(Requisicao.approver),
        joinedload(Requisicao.deposit_requesting),
        joinedload(Requisicao.deposit_fulfilling),
        joinedload(Requisicao.items).joinedload(RequisicaoItem.product),
    ).filter(Requisicao.id == req.id).first()
    return _req_to_response(req)


@router.get("/{requisicao_id}", response_model=RequisicaoResponse)
def get_requisicao(
    requisicao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes")),
):
    r = db.query(Requisicao).options(
        joinedload(Requisicao.requester),
        joinedload(Requisicao.approver),
        joinedload(Requisicao.deposit_requesting),
        joinedload(Requisicao.deposit_fulfilling),
        joinedload(Requisicao.items).joinedload(RequisicaoItem.product),
    ).filter(Requisicao.id == requisicao_id).first()
    if not r:
        raise HTTPException(404, "Requisição não encontrada")
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        visible = (
            r.requester_id == current_user.id
            or r.deposit_requesting_id in deposit_ids
            or (r.deposit_fulfilling_id in deposit_ids and r.status != "pendente")
        )
        if not visible:
            raise HTTPException(404, "Requisição não encontrada")
    return _req_to_response(r)


@router.put("/{requisicao_id}", response_model=RequisicaoResponse)
def update_requisicao(
    requisicao_id: int,
    data: RequisicaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    req = db.query(Requisicao).options(
        joinedload(Requisicao.items),
    ).filter(Requisicao.id == requisicao_id).first()
    if not req:
        raise HTTPException(404, "Requisição não encontrada")
    if not _is_requester_or_admin(db, req, current_user):
        raise HTTPException(403, "Apenas o requisitante pode editar a requisição")
    if req.status not in ("pendente",):
        raise HTTPException(400, "Só é possível editar requisições pendentes")

    apply_requisicao_update(req, data, db)

    db.commit()
    db.refresh(req)
    req = db.query(Requisicao).options(
        joinedload(Requisicao.requester),
        joinedload(Requisicao.approver),
        joinedload(Requisicao.deposit_requesting),
        joinedload(Requisicao.deposit_fulfilling),
        joinedload(Requisicao.items).joinedload(RequisicaoItem.product),
    ).filter(Requisicao.id == req.id).first()
    return _req_to_response(req)


@router.delete("/{requisicao_id}")
def delete_requisicao(
    requisicao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    req = db.query(Requisicao).filter(Requisicao.id == requisicao_id).first()
    if not req:
        raise HTTPException(404, "Requisição não encontrada")
    if not _is_requester_or_admin(db, req, current_user):
        raise HTTPException(403, "Apenas o requisitante pode remover a requisição")
    if req.status not in ("pendente", "cancelado"):
        raise HTTPException(400, "Só é possível remover requisições pendentes ou canceladas")
    db.delete(req)
    db.commit()
    return {"message": "Requisição removida"}


@router.put("/{requisicao_id}/approve", response_model=RequisicaoResponse)
def approve_requisicao(
    requisicao_id: int,
    data: RequisicaoApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    req = db.query(Requisicao).options(
        joinedload(Requisicao.items),
    ).filter(Requisicao.id == requisicao_id).first()
    if not req:
        raise HTTPException(404, "Requisição não encontrada")
    if not _is_requester_or_admin(db, req, current_user):
        raise HTTPException(403, "Apenas o requisitante pode liberar a requisição")
    if req.status != "pendente":
        raise HTTPException(400, "Requisição não está pendente")

    # validate all items have quantity_approved
    app_map = {it.product_id: it for it in data.items}
    for item in req.items:
        if item.product_id in app_map:
            qty = app_map[item.product_id].quantity_approved
            if qty is not None:
                item.quantity_approved = qty

    req.approver_id = current_user.id
    req.status = "aprovado"
    db.commit()
    db.refresh(req)
    req = db.query(Requisicao).options(
        joinedload(Requisicao.requester),
        joinedload(Requisicao.approver),
        joinedload(Requisicao.deposit_requesting),
        joinedload(Requisicao.deposit_fulfilling),
        joinedload(Requisicao.items).joinedload(RequisicaoItem.product),
    ).filter(Requisicao.id == req.id).first()
    return _req_to_response(req)


@router.put("/{requisicao_id}/fulfill", response_model=RequisicaoResponse)
def fulfill_requisicao(
    requisicao_id: int,
    data: RequisicaoFulfill,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    req = db.query(Requisicao).options(
        joinedload(Requisicao.requester),
        joinedload(Requisicao.approver),
        joinedload(Requisicao.deposit_requesting),
        joinedload(Requisicao.deposit_fulfilling),
        joinedload(Requisicao.items).joinedload(RequisicaoItem.product),
    ).filter(Requisicao.id == requisicao_id).first()
    if not req:
        raise HTTPException(404, "Requisição não encontrada")
    if req.status != "aprovado":
        raise HTTPException(400, "Requisição precisa estar liberada para ser atendida")
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if req.deposit_fulfilling_id not in deposit_ids:
            raise HTTPException(403, "Este depósito não pode atender esta requisição")

    qty_map = {it.product_id: it.quantity_fulfilled for it in data.items}
    for it in req.items:
        approved = it.quantity_approved or it.quantity_requested or 0
        delivered = qty_map.get(it.product_id, approved)
        if delivered is None:
            delivered = approved
        if delivered < 0:
            raise HTTPException(400, "Quantidade entregue não pode ser negativa")
        it.quantity_fulfilled = delivered

    req.status = "atendido"
    db.commit()
    db.refresh(req)
    req = db.query(Requisicao).options(
        joinedload(Requisicao.requester),
        joinedload(Requisicao.approver),
        joinedload(Requisicao.deposit_requesting),
        joinedload(Requisicao.deposit_fulfilling),
        joinedload(Requisicao.items).joinedload(RequisicaoItem.product),
    ).filter(Requisicao.id == req.id).first()
    return _req_to_response(req)


@router.put("/{requisicao_id}/receive", response_model=RequisicaoResponse)
def receive_requisicao(
    requisicao_id: int,
    data: RequisicaoReceive,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    req = db.query(Requisicao).options(
        joinedload(Requisicao.requester),
        joinedload(Requisicao.approver),
        joinedload(Requisicao.deposit_requesting),
        joinedload(Requisicao.deposit_fulfilling),
        joinedload(Requisicao.items).joinedload(RequisicaoItem.product),
    ).filter(Requisicao.id == requisicao_id).first()
    if not req:
        raise HTTPException(404, "Requisição não encontrada")
    if not _can_receive(db, req, current_user):
        raise HTTPException(403, "Apenas o requisitante ou o depósito solicitante pode confirmar o recebimento")
    if req.status != "atendido":
        raise HTTPException(400, "Requisição precisa estar atendida para ser recebida")

    rcv_map = {it.product_id: it.quantity_received for it in data.items}
    existing_saida = {m.product_id for m in db.query(StockMovement).filter(
        StockMovement.movement_type == "saida",
        StockMovement.reason.like(f"Requisição #{req.id}:%"),
    ).all()}
    for it in req.items:
        sent = it.quantity_fulfilled or it.quantity_approved or it.quantity_requested or 0
        received = rcv_map.get(it.product_id)
        if received is None:
            received = sent
        if received < 0:
            raise HTTPException(400, "Quantidade recebida não pode ser negativa")
        if received > sent:
            raise HTTPException(400, "Quantidade recebida não pode exceder a enviada")
        it.quantity_received = received
        if sent > 0 and it.product_id not in existing_saida:
            # create stock exit movement from deposit_fulfilling (recorded at receipt)
            total_val = sent * (it.unit_price or 0)
            mov = StockMovement(
                product_id=it.product_id,
                deposit_id=req.deposit_fulfilling_id,
                movement_type="saida",
                quantity=sent,
                unit_price=it.unit_price or 0,
                total_value=total_val,
                reason=f"Requisição #{req.id}: {req.reason or ''}",
                source="requisicao",
                user_id=current_user.id,
            )
            db.add(mov)
            recalculate_product_stock(db, it.product_id)
        if received <= 0:
            continue
        # create stock entry movement into deposit_requesting
        total_val = received * (it.unit_price or 0)
        mov = StockMovement(
            product_id=it.product_id,
            deposit_id=req.deposit_requesting_id,
            movement_type="entrada",
            quantity=received,
            unit_price=it.unit_price or 0,
            total_value=total_val,
            reason=f"Recebimento Requisição #{req.id}: {req.reason or ''}",
            source="requisicao",
            user_id=current_user.id,
        )
        db.add(mov)
        recalculate_product_stock(db, it.product_id)

    req.status = "recebido"
    db.commit()
    db.refresh(req)
    req = db.query(Requisicao).options(
        joinedload(Requisicao.requester),
        joinedload(Requisicao.approver),
        joinedload(Requisicao.deposit_requesting),
        joinedload(Requisicao.deposit_fulfilling),
        joinedload(Requisicao.items).joinedload(RequisicaoItem.product),
    ).filter(Requisicao.id == req.id).first()
    return _req_to_response(req)


@router.put("/{requisicao_id}/cancel", response_model=RequisicaoResponse)
def cancel_requisicao(
    requisicao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    req = db.query(Requisicao).options(
        joinedload(Requisicao.requester),
        joinedload(Requisicao.approver),
        joinedload(Requisicao.deposit_requesting),
        joinedload(Requisicao.deposit_fulfilling),
        joinedload(Requisicao.items).joinedload(RequisicaoItem.product),
    ).filter(Requisicao.id == requisicao_id).first()
    if not req:
        raise HTTPException(404, "Requisição não encontrada")
    if not _is_requester_or_admin(db, req, current_user):
        raise HTTPException(403, "Apenas o requisitante pode cancelar a requisição")
    if req.status in ("atendido", "recebido", "cancelado"):
        raise HTTPException(400, "Requisição já está " + req.status)
    req.status = "cancelado"
    db.commit()
    db.refresh(req)
    return _req_to_response(req)
