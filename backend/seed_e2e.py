"""Cria o conjunto mínimo e determinístico usado pelos testes E2E.

Este seed só deve ser executado em um banco exclusivo de testes. Ele pode ser
rodado mais de uma vez: registros existentes são reutilizados e normalizados,
sem duplicar dados nem trocar hashes de senhas que já correspondem ao valor
configurado.
"""

import os

from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.config import DATABASE_URL
from app.database import SessionLocal
from app.models import (
    Account,
    Category,
    Contact,
    Deposit,
    PaymentType,
    Product,
    Role,
    RoleModule,
    Unit,
    User,
)
from app.utils.security import get_password_hash, verify_password

COMMON_USER_MODULES = [
    "dashboard",
    "contacts",
    "deposits",
    "products",
    "stock_reports",
    "requisicoes",
    "categories",
    "units",
    "stock_movements",
    "accounts",
    "financial",
    "financial_categories",
    "payment_types",
    "recurrence_frequencies",
    "financial_reports",
    "sale_types",
    "sales",
    "price_tables",
    "precificacao",
]


def _env(name: str, default: str) -> str:
    return os.getenv(name, default).strip() or default


def _ensure_e2e_database(database_url: str) -> None:
    database_name = make_url(database_url).database or ""
    if "e2e" not in database_name.lower():
        raise RuntimeError(
            "O seed E2E exige um DATABASE_URL exclusivo contendo 'e2e' no nome."
        )


def _named_record(db: Session, model, name: str, **values):
    record = db.query(model).filter(model.name == name).first()
    if record is None:
        record = model(name=name)
        db.add(record)
    for field, value in values.items():
        setattr(record, field, value)
    db.flush()
    return record


def _role(db: Session, name: str, *, is_admin: bool, modules: list[str]) -> Role:
    role = _named_record(
        db,
        Role,
        name,
        is_admin=is_admin,
        is_default=False,
    )
    current_modules = {
        module.module: module.access_level
        for module in role.modules
    }
    expected_modules = {module: "edit" for module in modules}
    if current_modules != expected_modules:
        db.query(RoleModule).filter(RoleModule.role_id == role.id).delete()
        db.add_all([
            RoleModule(role_id=role.id, module=module, access_level="edit")
            for module in modules
        ])
        db.flush()
    return role


def _password_matches(password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    try:
        return verify_password(password, hashed_password)
    except ValueError:
        return False


def _user(
    db: Session,
    *,
    name: str,
    email: str,
    password: str,
    role: Role,
    deposits: list[Deposit],
) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(email=email, hashed_password=get_password_hash(password))
        db.add(user)
    elif not _password_matches(password, user.hashed_password):
        user.hashed_password = get_password_hash(password)
    user.name = name
    user.role = role.name
    user.is_active = True
    user.deposits = deposits
    db.flush()
    return user


def _product(
    db: Session,
    *,
    name: str,
    sku: str,
    price: float,
    cost_price: float,
    unit: Unit,
    category: Category,
    deposit: Deposit,
) -> Product:
    product = db.query(Product).filter(Product.sku == sku).first()
    if product is None:
        product = Product(sku=sku)
        db.add(product)
    product.name = name
    product.price = price
    product.cost_price = cost_price
    product.current_stock = 0
    product.min_stock = 0
    product.unit = unit
    product.category = category
    product.deposit = deposit
    product.is_active = True
    db.flush()
    return product


def seed_e2e(session_factory=SessionLocal, database_url: str = DATABASE_URL) -> None:
    _ensure_e2e_database(database_url)
    db = session_factory()
    try:
        admin_role = _role(db, "admin", is_admin=True, modules=[])
        common_role = _role(
            db,
            "usuario-e2e",
            is_admin=False,
            modules=COMMON_USER_MODULES,
        )

        central = _named_record(
            db,
            Deposit,
            "Depósito Central E2E",
            description="Origem dos fluxos E2E",
            is_active=True,
        )
        _named_record(
            db,
            Deposit,
            "Depósito Filial E2E",
            description="Destino dos fluxos E2E",
            is_active=True,
        )
        unit = _named_record(
            db,
            Unit,
            "Unidade E2E",
            abbreviation="un",
            is_active=True,
        )
        category = _named_record(
            db,
            Category,
            "Categoria E2E",
            description="Categoria exclusiva dos fluxos E2E",
            parent_id=None,
        )

        for product_data in [
            ("Arroz E2E", "E2E-001", 10.0, 6.0),
            ("Feijão E2E", "E2E-002", 12.0, 7.0),
            ("Café E2E", "E2E-003", 20.0, 12.0),
        ]:
            _product(
                db,
                name=product_data[0],
                sku=product_data[1],
                price=product_data[2],
                cost_price=product_data[3],
                unit=unit,
                category=category,
                deposit=central,
            )

        _named_record(
            db,
            Account,
            "Conta E2E",
            account_type="caixa",
            balance=1000.0,
            is_active=True,
        )
        _named_record(
            db,
            PaymentType,
            "Dinheiro E2E",
            description="Pagamento dos fluxos E2E",
            requires_installments=False,
            is_active=True,
        )
        _named_record(
            db,
            Contact,
            "Cliente E2E",
            contact_type="cliente",
            email="cliente@e2e.test",
            is_active=True,
        )

        _user(
            db,
            name="Administrador E2E",
            email=_env("E2E_ADMIN_EMAIL", "admin@e2e.test"),
            password=_env("E2E_ADMIN_PASSWORD", "admin-e2e"),
            role=admin_role,
            deposits=[],
        )
        _user(
            db,
            name="Usuário E2E",
            email=_env("E2E_USER_EMAIL", "usuario@e2e.test"),
            password=_env("E2E_USER_PASSWORD", "usuario-e2e"),
            role=common_role,
            deposits=[central],
        )

        db.commit()
        print("Seed E2E pronto: 2 usuários, 2 depósitos e 3 produtos.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_e2e()
