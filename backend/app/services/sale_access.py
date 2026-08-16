from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.sale import Sale
from app.models.user import User
from app.utils.security import is_admin_user, user_deposit_ids


def _is_admin(db: Session, user: User) -> bool:
    return is_admin_user(db, user)


def _product_deposit_ids_in_scope(db: Session, user: User, product_ids: list[int]) -> bool:
    """Checks if all given product_ids belong to at least one user deposit."""
    if _is_admin(db, user):
        return True
    deposit_ids = user_deposit_ids(user)
    if not deposit_ids:
        return len(product_ids) == 0
    count = db.query(Product).filter(
        Product.id.in_(product_ids),
        Product.deposit_id.in_(deposit_ids),
    ).count()
    return count == len(product_ids)


def is_sale_visible(db: Session, sale: Sale, user: User) -> bool:
    if _is_admin(db, user):
        return True
    deposit_ids = user_deposit_ids(user)
    product_ids = [item.product_id for item in sale.items]
    count = db.query(Product).filter(
        Product.id.in_(product_ids),
        Product.deposit_id.in_(deposit_ids),
    ).count()
    return count != 0
