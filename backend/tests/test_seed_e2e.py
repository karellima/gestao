import sqlite3

import bcrypt
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from seed_e2e import seed_e2e


def e2e_snapshot(database_path):
    queries = {
        "users": "SELECT name, email, hashed_password, role, is_active FROM users ORDER BY email",
        "deposits": "SELECT name, description, is_active FROM deposits ORDER BY name",
        "units": "SELECT name, abbreviation, is_active FROM units ORDER BY name",
        "categories": "SELECT name, description, parent_id FROM categories ORDER BY name",
        "products": (
            "SELECT name, sku, price, cost_price, current_stock, unit_id, category_id, "
            "deposit_id, is_active FROM products ORDER BY sku"
        ),
        "accounts": "SELECT name, account_type, balance, is_active FROM accounts ORDER BY name",
        "payment_types": (
            "SELECT name, description, requires_installments, is_active "
            "FROM payment_types ORDER BY name"
        ),
        "contacts": "SELECT name, contact_type, email, is_active FROM contacts ORDER BY name",
        "user_deposits": (
            "SELECT users.email, deposits.name FROM user_deposits "
            "JOIN users ON users.id = user_deposits.user_id "
            "JOIN deposits ON deposits.id = user_deposits.deposit_id "
            "ORDER BY users.email, deposits.name"
        ),
    }
    with sqlite3.connect(database_path) as connection:
        return {
            name: connection.execute(query).fetchall()
            for name, query in queries.items()
        }


def test_seed_e2e_cria_estado_fixo_e_idempotente(tmp_path, monkeypatch):
    database_path = tmp_path / "gestao-e2e.db"
    engine = create_engine(f"sqlite:///{database_path}")
    test_session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    monkeypatch.setenv("E2E_ADMIN_EMAIL", "admin-personalizado@e2e.test")
    monkeypatch.setenv("E2E_ADMIN_PASSWORD", "senha-admin-personalizada")

    database_url = f"sqlite:///{database_path}"
    seed_e2e(test_session, database_url)
    first_snapshot = e2e_snapshot(database_path)

    assert [(row[0], row[1], row[3], row[4]) for row in first_snapshot["users"]] == [
        ("Administrador E2E", "admin-personalizado@e2e.test", "admin", 1),
        ("Usuário E2E", "usuario@e2e.test", "usuario-e2e", 1),
    ]
    assert [row[0] for row in first_snapshot["deposits"]] == [
        "Depósito Central E2E",
        "Depósito Filial E2E",
    ]
    assert first_snapshot["units"] == [("Unidade E2E", "un", 1)]
    assert first_snapshot["categories"] == [
        ("Categoria E2E", "Categoria exclusiva dos fluxos E2E", None),
    ]
    assert [row[:5] for row in first_snapshot["products"]] == [
        ("Arroz E2E", "E2E-001", 10.0, 6.0, 0.0),
        ("Feijão E2E", "E2E-002", 12.0, 7.0, 0.0),
        ("Café E2E", "E2E-003", 20.0, 12.0, 0.0),
    ]
    assert first_snapshot["accounts"] == [("Conta E2E", "caixa", 1000.0, 1)]
    assert first_snapshot["payment_types"] == [
        ("Dinheiro E2E", "Pagamento dos fluxos E2E", 0, 1),
    ]
    assert first_snapshot["contacts"] == [
        ("Cliente E2E", "cliente", "cliente@e2e.test", 1),
    ]
    assert first_snapshot["user_deposits"] == [
        ("usuario@e2e.test", "Depósito Central E2E"),
    ]

    users_by_email = {row[1]: row for row in first_snapshot["users"]}
    assert bcrypt.checkpw(
        b"senha-admin-personalizada",
        users_by_email["admin-personalizado@e2e.test"][2].encode(),
    )
    assert bcrypt.checkpw(
        b"usuario-e2e",
        users_by_email["usuario@e2e.test"][2].encode(),
    )

    seed_e2e(test_session, database_url)
    assert e2e_snapshot(database_path) == first_snapshot


@pytest.mark.parametrize(
    "database_url",
    [
        "postgresql://e2e-runner@db/gestao",
        "postgresql://gestao@e2e-proxy/gestao",
        "postgresql://gestao@db/gestao?application_name=e2e",
    ],
)
def test_seed_e2e_recusa_banco_sem_nome_de_e2e(database_url):
    def session_must_not_open():
        raise AssertionError("o seed não deveria abrir o banco")

    try:
        seed_e2e(session_must_not_open, database_url)
    except RuntimeError as error:
        assert "DATABASE_URL exclusivo contendo 'e2e'" in str(error)
    else:
        raise AssertionError("o seed aceitou um banco que não é de E2E")
