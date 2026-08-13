import hashlib
import os
import tempfile

#: O banco de teste mora no temp do sistema, que é compartilhado por todo mundo
#: na máquina. Com nome fixo, dois pytest ao mesmo tempo — dois worktrees, duas
#: sessões de agente, ou você e o CI local — apagam o banco um do outro no meio
#: da rodada, porque a fixture `db` faz drop_all a cada teste. O erro sai como
#: OperationalError sem nenhuma relação com o teste que falhou, e some quando
#: você roda de novo sozinho. O caminho leva o hash do checkout e o PID para que
#: cada processo tenha o seu.
_CHECKOUT_ID = hashlib.sha256(
    os.path.dirname(os.path.abspath(__file__)).encode(),
).hexdigest()[:8]
TEST_DB = os.path.join(
    tempfile.gettempdir(),
    f"onda3_test_financas_{_CHECKOUT_ID}_{os.getpid()}.db",
)
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["SECRET_KEY"] = "test-secret-key"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine, get_db
from app.models.account import Account
from app.models.contact import Contact
from app.models.deposit import Deposit
from app.models.financial_category import FinancialCategory
from app.models.payment_type import PaymentType
from app.models.product import Category, Product
from app.models.role import Role, RoleModule
from app.models.sale import SaleType
from app.models.stock import StockMovement
from app.models.unit import Unit
from app.models.user import User
from app.utils.security import create_access_token, get_current_user, get_password_hash


@pytest.fixture(scope="function")
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db():
    yield
    try:
        os.unlink(TEST_DB)
    except FileNotFoundError:
        pass


@pytest.fixture(scope="function")
def client(db, request, admin):
    from app.main import app

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    if (
        "auth_headers" not in request.fixturenames
        and "operador_headers" not in request.fixturenames
        and request.module.__name__.split(".")[-1] != "test_auth"
    ):
        app.dependency_overrides[get_current_user] = lambda: admin
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def admin_role(db: Session):
    role = db.query(Role).filter(Role.name == "admin").first()
    if not role:
        role = Role(name="admin", is_admin=True, is_default=False)
        db.add(role)
        db.commit()
        db.refresh(role)
    return role


@pytest.fixture(scope="function")
def admin_user(db: Session, admin_role):
    user = User(
        name="Administrador",
        email="admin@test.com",
        hashed_password=get_password_hash("admin"),
        role="admin",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers(admin_user):
    token = create_access_token({"sub": str(admin_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def seed_units(db: Session):
    units = [
        Unit(name="Unidade", abbreviation="un"),
        Unit(name="Quilograma", abbreviation="kg"),
        Unit(name="Litro", abbreviation="L"),
    ]
    db.add_all(units)
    db.commit()
    return units


@pytest.fixture(scope="function")
def seed_categories(db: Session):
    cats = [Category(name="Geral")]
    db.add_all(cats)
    db.commit()
    return cats


@pytest.fixture(scope="function")
def seed_deposits(db: Session):
    deps = [
        Deposit(name="Depósito Central", description="Principal"),
        Deposit(name="Depósito Filial", description="Filial"),
    ]
    db.add_all(deps)
    db.commit()
    return deps


@pytest.fixture(scope="function")
def seed_products(db: Session, seed_deposits, seed_units, seed_categories):
    products = [
        Product(
            name="Produto A", sku="PROD-A", price=50.0, cost_price=30.0, current_stock=100,
            unit_id=seed_units[0].id, category_id=seed_categories[0].id,
            deposit_id=seed_deposits[0].id,
        ),
        Product(
            name="Produto B", sku="PROD-B", price=100.0, cost_price=60.0, current_stock=50,
            unit_id=seed_units[0].id, category_id=seed_categories[0].id,
            deposit_id=seed_deposits[0].id,
        ),
    ]
    db.add_all(products)
    db.commit()
    return products


@pytest.fixture(scope="function")
def seed_financial_categories(db: Session):
    cats = [
        FinancialCategory(name="Vendas", type="receita"),
        FinancialCategory(name="Compras", type="despesa"),
    ]
    db.add_all(cats)
    db.commit()
    return cats


@pytest.fixture(scope="function")
def seed_payment_types(db: Session):
    pts = [PaymentType(name="Dinheiro", requires_installments=False)]
    db.add_all(pts)
    db.commit()
    return pts


@pytest.fixture(scope="function")
def seed_accounts(db: Session):
    accts = [Account(name="Caixa", account_type="conta_corrente")]
    db.add_all(accts)
    db.commit()
    return accts


@pytest.fixture(scope="function")
def seed_contacts(db: Session):
    contacts = [
        Contact(name="Cliente A", contact_type="cliente"),
        Contact(name="Fornecedor B", contact_type="fornecedor"),
    ]
    db.add_all(contacts)
    db.commit()
    return contacts


@pytest.fixture(scope="function")
def seed_sale_types(db: Session):
    types = [SaleType(name="Venda Direta"), SaleType(name="Encomenda")]
    db.add_all(types)
    db.commit()
    return types


ALL_MODULES = [
    "dashboard", "contacts", "deposits", "deposits_manage", "products",
    "stock_reports", "requisicoes", "categories", "units", "stock_movements",
    "accounts", "financial", "financial_categories", "payment_types",
    "recurrence_frequencies", "financial_reports", "sale_types", "sales",
    "users", "roles", "precificacao", "price_tables", "settings",
]


@pytest.fixture(scope="function")
def operador_role(db: Session):
    role = Role(name="operador", is_admin=False, is_default=False)
    db.add(role)
    db.flush()
    for m in ALL_MODULES:
        db.add(RoleModule(role_id=role.id, module=m, access_level="edit"))
    db.commit()
    return role


@pytest.fixture(scope="function")
def operador_user(db: Session, operador_role, seed_deposits):
    user = User(
        name="Operador",
        email="operador@test.com",
        hashed_password=get_password_hash("operador"),
        role="operador",
        is_active=True,
    )
    user.deposits.append(seed_deposits[0])
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def operador_headers(operador_user):
    token = create_access_token({"sub": str(operador_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def admin(db: Session):
    role = db.query(Role).filter(Role.name == "admin").first()
    if not role:
        role = Role(name="admin", is_admin=True, is_default=False)
        db.add(role)
        db.flush()
    user = db.query(User).filter(User.email == "admin@teste.com").first()
    if not user:
        user = User(
            name="Admin", email="admin@teste.com", hashed_password="x",
            role="admin", is_active=True,
        )
        db.add(user)
        db.commit()
    login_user = db.query(User).filter(User.email == "admin@admin.com").first()
    if not login_user:
        db.add(User(
            name="Administrador", email="admin@admin.com",
            hashed_password=get_password_hash("admin"), role="admin", is_active=True,
        ))
        db.commit()
    return user


@pytest.fixture(scope="function")
def produto(db: Session):
    product = db.query(Product).filter(Product.name == "Café 1kg").first()
    if not product:
        product = Product(name="Café 1kg", current_stock=0)
        db.add(product)
        db.add(Product(name="Açúcar 1kg", current_stock=0))
        db.commit()
    return product


@pytest.fixture(scope="function")
def deposito(db: Session):
    deposit = db.query(Deposit).filter(Deposit.name == "Depósito Central").first()
    if not deposit:
        deposit = Deposit(name="Depósito Central", is_active=True)
        db.add(deposit)
        db.commit()
    return deposit


@pytest.fixture(scope="function")
def nova_movimentacao(db: Session, produto, deposito, admin):
    def _criar(movement_type="entrada", quantity=10, unit_price=5.0, **extra):
        mov = StockMovement(
            product_id=extra.pop("product_id", produto.id),
            deposit_id=extra.pop("deposit_id", deposito.id),
            movement_type=movement_type,
            quantity=quantity,
            unit_price=unit_price,
            total_value=quantity * unit_price,
            user_id=admin.id,
            **extra,
        )
        db.add(mov)
        db.commit()
        db.refresh(mov)
        return mov
    return _criar
