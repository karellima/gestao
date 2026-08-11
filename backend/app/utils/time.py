from datetime import UTC, datetime


def utc_now_naive() -> datetime:
    """Retorna o instante UTC no formato legado persistido pelo banco."""
    return datetime.now(UTC).replace(tzinfo=None)
