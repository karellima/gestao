from sqlalchemy.orm import Session, joinedload

from app.models.requisicao import Requisicao, RequisicaoItem


def query_requisicoes(db: Session):
    return db.query(Requisicao).options(
        joinedload(Requisicao.requester),
        joinedload(Requisicao.approver),
        joinedload(Requisicao.deposit_requesting),
        joinedload(Requisicao.deposit_fulfilling),
        joinedload(Requisicao.items).joinedload(RequisicaoItem.product),
    )


def query_requisicao_itens(db: Session):
    return db.query(Requisicao).options(
        joinedload(Requisicao.items),
    )
