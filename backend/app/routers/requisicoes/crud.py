from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.deposit import Deposit
from app.models.product import Product
from app.models.requisicao import Requisicao, RequisicaoItem
from app.models.user import User
from app.routers.requisicoes.apresentacao import _req_to_response
from app.routers.requisicoes.consulta import query_requisicao_itens, query_requisicoes
from app.schemas.requisicao import RequisicaoCreate, RequisicaoResponse, RequisicaoUpdate
from app.services.requisition_access import (
    _is_requester_or_admin,
    apply_requisition_visibility_filter,
    is_requisition_visible,
)
from app.services.requisition_workflow import apply_requisicao_update
from app.utils.security import get_current_user, require_module

router = APIRouter()


@router.get("/", response_model=list[RequisicaoResponse])
def list_requisicoes(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes")),
):
    query = apply_requisition_visibility_filter(
        query_requisicoes(db), db, current_user,
    )
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
    req = query_requisicoes(db).filter(Requisicao.id == req.id).first()
    return _req_to_response(req)


@router.get("/{requisicao_id}", response_model=RequisicaoResponse)
def get_requisicao(
    requisicao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes")),
):
    req = query_requisicoes(db).filter(Requisicao.id == requisicao_id).first()
    if not req:
        raise HTTPException(404, "Requisição não encontrada")
    if not is_requisition_visible(db, req, current_user):
        raise HTTPException(404, "Requisição não encontrada")
    return _req_to_response(req)


@router.put("/{requisicao_id}", response_model=RequisicaoResponse)
def update_requisicao(
    requisicao_id: int,
    data: RequisicaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_module("requisicoes", "edit")),
):
    req = query_requisicao_itens(db).filter(Requisicao.id == requisicao_id).first()
    if not req:
        raise HTTPException(404, "Requisição não encontrada")
    if not _is_requester_or_admin(db, req, current_user):
        raise HTTPException(403, "Apenas o requisitante pode editar a requisição")
    if req.status not in ("pendente",):
        raise HTTPException(400, "Só é possível editar requisições pendentes")

    apply_requisicao_update(req, data, db)

    db.commit()
    db.refresh(req)
    req = query_requisicoes(db).filter(Requisicao.id == req.id).first()
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
