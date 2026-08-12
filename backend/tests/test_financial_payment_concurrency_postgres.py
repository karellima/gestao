"""Concorrência real de pagamentos; requer PostgreSQL exclusivo de E2E."""

import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

import app.models as model_registry
from app.database import Base
from app.models.account import Account
from app.models.financial import Transaction
from app.models.payment import Payment
from app.schemas.payment import PaymentCreate
from app.services.financial_payments import record_payment

POSTGRES_URL = os.getenv("POSTGRES_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="defina POSTGRES_TEST_DATABASE_URL para executar concorrência real",
)


@pytest.fixture()
def postgres_sessions():
    assert model_registry.__all__, "o registry deve carregar todos os models no metadata"
    assert POSTGRES_URL is not None
    url = make_url(POSTGRES_URL)
    assert url.get_backend_name() == "postgresql"
    assert "e2e" in (url.database or "").lower()
    schema = f"financial_payment_{uuid.uuid4().hex}"
    engine = create_engine(POSTGRES_URL)
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET search_path TO "{schema}"'))
        Base.metadata.create_all(connection)

    @contextmanager
    def open_session():
        connection = engine.connect()
        connection.execute(text(f'SET search_path TO "{schema}"'))
        connection.commit()
        db = Session(bind=connection)
        try:
            yield db
        finally:
            db.close()
            connection.close()

    yield open_session

    engine.dispose()
    cleanup = create_engine(POSTGRES_URL)
    with cleanup.begin() as connection:
        connection.execute(text("SET lock_timeout TO '5s'"))
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    cleanup.dispose()


def _seed_transactions(open_session, amounts=(100.0,)):
    with open_session() as db:
        account = Account(name="Conta concorrência", account_type="caixa", balance=1000)
        db.add(account)
        db.flush()
        transactions = [
            Transaction(
                type="despesa",
                description=f"Despesa concorrente {index}",
                amount=amount,
                date=datetime(2026, 8, 12, 12, tzinfo=UTC),
                account_id=account.id,
            )
            for index, amount in enumerate(amounts, start=1)
        ]
        db.add_all(transactions)
        db.commit()
        return account.id, [transaction.id for transaction in transactions]


def _payment(transaction_id, amount):
    return PaymentCreate(
        transaction_id=transaction_id,
        amount=amount,
        payment_date="2026-08-12T12:00:00",
    )


def test_pagamentos_concorrentes_nao_baixam_a_mesma_despesa_duas_vezes(postgres_sessions):
    account_id, transaction_ids = _seed_transactions(postgres_sessions)
    transaction_id = transaction_ids[0]
    first_ready = threading.Event()
    release_first = threading.Event()
    second_done = threading.Event()

    def first():
        with postgres_sessions() as db:
            assert record_payment(db, _payment(transaction_id, 100)) is not None
            first_ready.set()
            assert release_first.wait(timeout=5)
            db.commit()

    def second():
        assert first_ready.wait(timeout=5)
        with postgres_sessions() as db:
            with pytest.raises(ValueError, match="excede"):
                record_payment(db, _payment(transaction_id, 100))
            db.rollback()
        second_done.set()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(first), executor.submit(second)]
        assert first_ready.wait(timeout=5)
        assert not second_done.wait(timeout=0.2), "o segundo pagamento ignorou o lock"
        release_first.set()
        for future in futures:
            future.result(timeout=5)

    with postgres_sessions() as db:
        assert db.get(Account, account_id).balance == 900
        assert db.query(Payment).filter(Payment.transaction_id == transaction_id).count() == 1


def test_pagamentos_de_transacoes_distintas_serializam_o_saldo(postgres_sessions):
    account_id, transaction_ids = _seed_transactions(postgres_sessions, (100, 50))
    first_ready = threading.Event()
    release_first = threading.Event()
    second_done = threading.Event()

    def pay(transaction_id, amount, *, hold=False):
        with postgres_sessions() as db:
            assert record_payment(db, _payment(transaction_id, amount)) is not None
            if hold:
                first_ready.set()
                assert release_first.wait(timeout=5)
            db.commit()

    def second():
        assert first_ready.wait(timeout=5)
        pay(transaction_ids[1], 50)
        second_done.set()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(pay, transaction_ids[0], 100, hold=True),
            executor.submit(second),
        ]
        assert first_ready.wait(timeout=5)
        assert not second_done.wait(timeout=0.2), "o segundo pagamento ignorou o lock da conta"
        release_first.set()
        for future in futures:
            future.result(timeout=5)

    with postgres_sessions() as db:
        assert db.get(Account, account_id).balance == 850
        assert db.query(Payment).count() == 2
