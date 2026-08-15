from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.requisicao import Requisicao
from app.models.user import User
from app.routers.requisicoes.apresentacao import _req_to_response
from app.routers.requisicoes.consulta import query_requisicao_itens, query_requisicoes
from app.schemas.requisicao import (
    RequisicaoApprove,
    RequisicaoFulfill,
    RequisicaoReceive,
    RequisicaoResponse,
)
from app.services.requisition_access import (
    _can_receive,
    _is_admin,
    _is_requester_or_admin,
)
from app.services.requisition_workflow import record_requisition_movements
from app.utils.security import get_current_user, require_module, user_deposit_ids

router = APIRouter()


@router.put("/{requisicao_id}/approve", response_model=RequisicaoResponse)
def approve_requisicao(
    requisicao_id: int,
    data: RequisicaoApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    req = query_requisicao_itens(db).filter(Requisicao.id == requisicao_id).first()
    if not req:
        raise HTTPException(404, "Requisição não encontrada")
    if not _is_requester_or_admin(db, req, current_user):
        raise HTTPException(403, "Apenas o requisitante pode liberar a requisição")
    if req.status != "pendente":
        raise HTTPException(400, "Requisição não está pendente")

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
    req = query_requisicoes(db).filter(Requisicao.id == req.id).first()
    return _req_to_response(req)


def _apply_fulfilled_quantities(req: Requisicao, data: RequisicaoFulfill) -> None:
    qty_map = {it.product_id: it.quantity_fulfilled for it in data.items}
    for item in req.items:
        approved = item.quantity_approved or item.quantity_requested or 0
        delivered = qty_map.get(item.product_id, approved)
        if delivered is None:
            delivered = approved
        if delivered < 0:
            raise HTTPException(400, "Quantidade entregue não pode ser negativa")
        item.quantity_fulfilled = delivered


@router.put("/{requisicao_id}/fulfill", response_model=RequisicaoResponse)
def fulfill_requisicao(
    requisicao_id: int,
    data: RequisicaoFulfill,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    req = query_requisicoes(db).filter(Requisicao.id == requisicao_id).first()
    if not req:
        raise HTTPException(404, "Requisição não encontrada")
    if req.status != "aprovado":
        raise HTTPException(400, "Requisição precisa estar liberada para ser atendida")
    if not _is_admin(db, current_user):
        deposit_ids = user_deposit_ids(current_user)
        if req.deposit_fulfilling_id not in deposit_ids:
            raise HTTPException(403, "Este depósito não pode atender esta requisição")

    _apply_fulfilled_quantities(req, data)
    req.status = "atendido"
    db.commit()
    db.refresh(req)
    req = query_requisicoes(db).filter(Requisicao.id == req.id).first()
    return _req_to_response(req)


@router.put("/{requisicao_id}/receive", response_model=RequisicaoResponse)
def receive_requisicao(
    requisicao_id: int,
    data: RequisicaoReceive,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    locked = db.query(Requisicao.id).filter(
        Requisicao.id == requisicao_id,
    ).with_for_update().first()
    if not locked:
        raise HTTPException(404, "Requisição não encontrada")
    req = query_requisicoes(db).filter(Requisicao.id == requisicao_id).first()
    if not req:
        raise HTTPException(404, "Requisição não encontrada")
    if not _can_receive(db, req, current_user):
        raise HTTPException(403, "Apenas o requisitante ou o depósito solicitante pode confirmar o recebimento")
    if req.status != "atendido":
        raise HTTPException(400, "Requisição precisa estar atendida para ser recebida")

    quantidades = _resolver_quantidades(req, data)
    record_requisition_movements(db, req, quantidades, current_user.id)
    req.status = "recebido"
    db.commit()
    db.refresh(req)
    req = query_requisicoes(db).filter(Requisicao.id == req.id).first()
    return _req_to_response(req)


def _resolver_quantidades(
    req: Requisicao,
    data: RequisicaoReceive,
) -> dict[int, tuple[float, float]]:
    """Resolve e valida sent/received por item. Única fonte desta derivação."""
    received_map = {it.product_id: it.quantity_received for it in data.items}
    quantidades = {}
    for item in req.items:
        sent = item.quantity_fulfilled or item.quantity_approved or item.quantity_requested or 0
        received = received_map.get(item.product_id)
        if received is None:
            received = sent
        if received < 0:
            raise HTTPException(400, "Quantidade recebida não pode ser negativa")
        if received > sent:
            raise HTTPException(400, "Quantidade recebida não pode exceder a enviada")
        item.quantity_received = received
        quantidades[item.id] = (sent, received)
    return quantidades


@router.put("/{requisicao_id}/cancel", response_model=RequisicaoResponse)
def cancel_requisicao(
    requisicao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    req = query_requisicoes(db).filter(Requisicao.id == requisicao_id).first()
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
