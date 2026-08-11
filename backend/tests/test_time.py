from datetime import UTC, datetime

from app.utils.time import naive_utc, utc_now_naive


def test_utc_now_naive_retorna_utc_sem_timezone_implicitamente_local():
    before = datetime.now(UTC).replace(tzinfo=None)
    value = utc_now_naive()
    after = datetime.now(UTC).replace(tzinfo=None)

    assert value.tzinfo is None
    assert before <= value <= after


def test_naive_utc_cria_datetime_utc_sem_timezone():
    value = naive_utc(2026, 8, 11)

    assert (value.year, value.month, value.day) == (2026, 8, 11)
    assert value.tzinfo is None
