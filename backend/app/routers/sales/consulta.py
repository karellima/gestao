from sqlalchemy.orm import Session, joinedload

from app.models.product import Product
from app.models.sale import Sale, SaleItem


def query_sales(db: Session):
    return db.query(Sale).options(
        joinedload(Sale.contact),
        joinedload(Sale.sale_type),
        joinedload(Sale.items).joinedload(SaleItem.product).joinedload(Product.unit),
    )
