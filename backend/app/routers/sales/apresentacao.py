from app.models.sale import Sale
from app.schemas.sale import SaleItemResponse, SaleResponse
from app.utils.helpers import product_label


def _sale_to_response(sale: Sale) -> SaleResponse:
    items = [
        SaleItemResponse(
            id=item.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.total_price,
            product_name=product_label(item.product),
        )
        for item in sale.items
    ]
    return SaleResponse(
        id=sale.id,
        contact_id=sale.contact_id,
        sale_type_id=sale.sale_type_id,
        total_amount=sale.total_amount,
        status=sale.status,
        notes=sale.notes,
        created_at=sale.created_at,
        updated_at=sale.updated_at,
        contact_name=sale.contact.name if sale.contact else None,
        sale_type_name=sale.sale_type.name if sale.sale_type else None,
        items=items,
    )
