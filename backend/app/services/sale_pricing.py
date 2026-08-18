from app.models.contact import Contact
from app.models.price_table import PriceTable
from app.models.product import Product


def _client_table_prices(db, contact_id: int) -> dict[int, float]:
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact or not contact.price_table_id:
        return {}
    table = db.query(PriceTable).filter(
        PriceTable.id == contact.price_table_id,
        PriceTable.is_active == True,
    ).first()
    if not table:
        return {}
    return {item.product_id: item.price for item in table.items}


def resolve_price(
    table_prices: dict[int, float],
    db,
    product_id: int,
    sent_price: float,
) -> float:
    if not table_prices:
        return sent_price
    if product_id in table_prices:
        return table_prices[product_id]
    product = db.query(Product).filter(Product.id == product_id).first()
    return product.price if product and product.price else sent_price
