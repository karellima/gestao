from app.models.requisicao import Requisicao
from app.schemas.requisicao import RequisicaoItemResponse, RequisicaoResponse
from app.utils.helpers import product_label


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
