from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.requisicao import Requisicao
from app.models.user import User
from app.utils.security import is_admin_user, user_deposit_ids


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


def apply_requisition_visibility_filter(query, db: Session, user: User):
    """Aplica em SQL a mesma regra de visibilidade de `is_requisition_visible`."""
    if _is_admin(db, user):
        return query
    deposit_ids = user_deposit_ids(user)
    return query.filter(or_(
        Requisicao.requester_id == user.id,
        Requisicao.deposit_requesting_id.in_(deposit_ids),
        and_(
            Requisicao.deposit_fulfilling_id.in_(deposit_ids),
            Requisicao.status != "pendente",
        ),
    ))


def is_requisition_visible(db: Session, req: Requisicao, user: User) -> bool:
    """Predicado em memória que espelha `apply_requisition_visibility_filter`."""
    if _is_admin(db, user):
        return True
    deposit_ids = user_deposit_ids(user)
    return (
        req.requester_id == user.id
        or req.deposit_requesting_id in deposit_ids
        or (req.deposit_fulfilling_id in deposit_ids and req.status != "pendente")
    )
