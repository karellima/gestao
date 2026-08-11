from datetime import UTC, datetime


def naive_utc(year: int, month: int, day: int) -> datetime:
    """Cria uma data UTC sem timezone para colunas legadas do banco."""
    return datetime(year, month, day, tzinfo=UTC).replace(tzinfo=None)


def utc_now_naive() -> datetime:
    """Retorna o instante UTC no formato legado persistido pelo banco."""
    return datetime.now(UTC).replace(tzinfo=None)
