"""Recria o banco PostgreSQL exclusivo da suíte E2E."""

import os

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


DEFAULT_DATABASE_URL = "postgresql://gestao:gestao@127.0.0.1:5432/gestao_e2e"


def _quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def reset_e2e_database(database_url: str) -> None:
    url = make_url(database_url)
    database_name = url.database or ""
    if url.get_backend_name() != "postgresql" or "e2e" not in database_name.lower():
        raise RuntimeError(
            "O reset E2E exige um PostgreSQL exclusivo contendo 'e2e' no nome."
        )

    admin_engine = create_engine(
        url.set(database="postgres"),
        isolation_level="AUTOCOMMIT",
    )
    quoted_name = _quote_identifier(database_name)
    try:
        with admin_engine.connect() as connection:
            connection.execute(text(f"DROP DATABASE IF EXISTS {quoted_name} WITH (FORCE)"))
            connection.execute(text(f"CREATE DATABASE {quoted_name}"))
    finally:
        admin_engine.dispose()


if __name__ == "__main__":
    reset_e2e_database(os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
    print("Banco E2E recriado.")
