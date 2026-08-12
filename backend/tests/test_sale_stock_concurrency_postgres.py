"""Concorrência real do ledger de vendas; requer PostgreSQL exclusivo de E2E."""

import os
import threading
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.database import Base
from app.models.contact import Contact
from app.models.deposit import Deposit
from app.models.product import Category, Product
from app.models.sale import Sale, SaleItem, SaleType
from app.models.stock import StockMovement
from app.models.unit import Unit
from app.services.sale_stock import (
    compensate_sale_stock,
    lock_sale,
    record_sale_stock,
)
from app.services.stock_ledger import lock_stock_products, recalculate_product_stock

POSTGRES_URL = os.getenv("POSTGRES_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="defina POSTGRES_TEST_DATABASE_URL para executar concorrência real",
)


@pytest.fixture()
def postgres_sessions():
    assert POSTGRES_URL is not None
    url = make_url(POSTGRES_URL)
    assert url.get_backend_name() == "postgresql"
    assert "e2e" in (url.database or "").lower()
    schema = f"sale_stock_{uuid.uuid4().hex}"
    engine = create_engine(POSTGRES_URL)
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET search_path TO "{schema}"'))
        Base.metadata.create_all(connection)

    def open_session() -> tuple[Session, object]:
        connection = engine.connect()
        connection.execute(text(f'SET search_path TO "{schema}"'))
        connection.commit()
        return Session(bind=connection), connection

    yield open_session

    engine.dispose()
    cleanup = create_engine(POSTGRES_URL)
    with cleanup.begin() as connection:
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    cleanup.dispose()


def _seed_sale_stock(open_session):
    db, connection = open_session()
    deposit = Deposit(name="Depósito concorrência", is_active=True)
    unit = Unit(name="Unidade concorrência", abbreviation="un", is_active=True)
    category = Category(name="Categoria concorrência")
    contact = Contact(name="Cliente concorrência", contact_type="cliente")
    sale_type = SaleType(name="Venda concorrência", is_active=True)
    db.add_all([deposit, unit, category, contact, sale_type])
    db.flush()
    product = Product(
        name="Produto concorrência",
        sku=f"CONC-{uuid.uuid4().hex}",
        price=10,
        cost_price=5,
        deposit_id=deposit.id,
        unit_id=unit.id,
        category_id=category.id,
        current_stock=0,
        is_active=True,
    )
    db.add(product)
    db.flush()
    db.add(StockMovement(
        product_id=product.id,
        deposit_id=deposit.id,
        movement_type="entrada",
        quantity=100,
        unit_price=5,
        total_value=500,
        source="teste",
    ))
    sales = []
    for quantity in (1, 2):
        sale = Sale(
            contact_id=contact.id,
            sale_type_id=sale_type.id,
            total_amount=quantity * 10,
            items=[SaleItem(
                product_id=product.id,
                quantity=quantity,
                unit_price=10,
                total_price=quantity * 10,
            )],
        )
        db.add(sale)
        sales.append(sale)
    db.flush()
    recalculate_product_stock(db, product.id, commit=False)
    db.commit()
    result = product.id, [sale.id for sale in sales]
    db.close()
    connection.close()
    return result


def _run_thread(target, errors):
    try:
        target()
    except (AssertionError, SQLAlchemyError, ValueError) as error:
        errors.append(error)


def test_vendas_concorrentes_serializam_cache_por_produto(postgres_sessions):
    product_id, sale_ids = _seed_sale_stock(postgres_sessions)
    first_locked = threading.Event()
    release_first = threading.Event()
    second_done = threading.Event()
    errors = []

    def first():
        db, connection = postgres_sessions()
        lock_stock_products(db, {product_id})
        first_locked.set()
        assert release_first.wait(timeout=5)
        record_sale_stock(db, sale_ids[0], None, products_locked=True)
        db.commit()
        db.close()
        connection.close()

    def second():
        assert first_locked.wait(timeout=5)
        db, connection = postgres_sessions()
        record_sale_stock(db, sale_ids[1], None)
        db.commit()
        db.close()
        connection.close()
        second_done.set()

    threads = [
        threading.Thread(target=_run_thread, args=(first, errors)),
        threading.Thread(target=_run_thread, args=(second, errors)),
    ]
    for thread in threads:
        thread.start()
    assert first_locked.wait(timeout=5)
    assert not second_done.wait(timeout=0.2), "a segunda venda ignorou o lock do produto"
    release_first.set()
    for thread in threads:
        thread.join(timeout=5)

    assert not any(thread.is_alive() for thread in threads)
    assert not errors
    db, connection = postgres_sessions()
    product = db.get(Product, product_id)
    assert product.current_stock == 97
    assert db.query(StockMovement).filter(StockMovement.source == "venda").count() == 2
    db.close()
    connection.close()


def test_compensacao_concorrente_acontece_uma_unica_vez(postgres_sessions):
    product_id, sale_ids = _seed_sale_stock(postgres_sessions)
    setup, setup_connection = postgres_sessions()
    record_sale_stock(setup, sale_ids[0], None)
    setup.commit()
    setup.close()
    setup_connection.close()

    first_locked = threading.Event()
    release_first = threading.Event()
    second_done = threading.Event()
    errors = []

    def compensate(*, hold=False):
        db, connection = postgres_sessions()
        assert lock_sale(db, sale_ids[0]) is not None
        if hold:
            first_locked.set()
            assert release_first.wait(timeout=5)
        lock_stock_products(db, {product_id})
        compensate_sale_stock(db, sale_ids[0], None, products_locked=True)
        db.commit()
        db.close()
        connection.close()

    def second():
        assert first_locked.wait(timeout=5)
        compensate()
        second_done.set()

    threads = [
        threading.Thread(
            target=_run_thread,
            args=(lambda: compensate(hold=True), errors),
        ),
        threading.Thread(target=_run_thread, args=(second, errors)),
    ]
    for thread in threads:
        thread.start()
    assert first_locked.wait(timeout=5)
    assert not second_done.wait(timeout=0.2), "a segunda compensação ignorou o lock da venda"
    release_first.set()
    for thread in threads:
        thread.join(timeout=5)

    assert not any(thread.is_alive() for thread in threads)
    assert not errors
    db, connection = postgres_sessions()
    original = db.query(StockMovement).filter(StockMovement.source == "venda").one()
    compensations = db.query(StockMovement).filter(
        StockMovement.compensates_movement_id == original.id,
    ).all()
    assert len(compensations) == 1
    assert db.get(Product, product_id).current_stock == 100
    db.close()
    connection.close()


def test_venda_e_entrada_manual_compartilham_lock_do_ledger(postgres_sessions):
    product_id, sale_ids = _seed_sale_stock(postgres_sessions)
    sale_locked = threading.Event()
    release_sale = threading.Event()
    manual_done = threading.Event()
    errors = []

    def sale():
        db, connection = postgres_sessions()
        lock_stock_products(db, {product_id})
        sale_locked.set()
        assert release_sale.wait(timeout=5)
        record_sale_stock(db, sale_ids[0], None, products_locked=True)
        db.commit()
        db.close()
        connection.close()

    def manual_entry():
        assert sale_locked.wait(timeout=5)
        db, connection = postgres_sessions()
        lock_stock_products(db, {product_id})
        product = db.get(Product, product_id)
        db.add(StockMovement(
            product_id=product_id,
            deposit_id=product.deposit_id,
            movement_type="entrada",
            quantity=5,
            unit_price=5,
            total_value=25,
            source="manual",
        ))
        recalculate_product_stock(db, product_id, commit=False)
        db.commit()
        db.close()
        connection.close()
        manual_done.set()

    threads = [
        threading.Thread(target=_run_thread, args=(sale, errors)),
        threading.Thread(target=_run_thread, args=(manual_entry, errors)),
    ]
    for thread in threads:
        thread.start()
    assert sale_locked.wait(timeout=5)
    assert not manual_done.wait(timeout=0.2), "a entrada manual ignorou o lock do ledger"
    release_sale.set()
    for thread in threads:
        thread.join(timeout=5)

    assert not any(thread.is_alive() for thread in threads)
    assert not errors
    db, connection = postgres_sessions()
    assert db.get(Product, product_id).current_stock == 104
    assert db.query(StockMovement).filter(
        StockMovement.product_id == product_id,
    ).count() == 3
    db.close()
    connection.close()
