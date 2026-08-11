from datetime import UTC, datetime

from app.utils.time import utc_now_naive


def test_utc_now_naive_retorna_utc_sem_timezone_implicitamente_local():
    before = datetime.now(UTC).replace(tzinfo=None)
    value = utc_now_naive()
    after = datetime.now(UTC).replace(tzinfo=None)

    assert value.tzinfo is None
    assert before <= value <= after
