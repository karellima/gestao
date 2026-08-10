import os
import tempfile
import shutil
import atexit

import pytest

temp_dir = tempfile.mkdtemp(prefix="gestao_test_")
test_db_path = os.path.join(temp_dir, "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"

atexit.register(lambda: shutil.rmtree(temp_dir, ignore_errors=True))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, get_db


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
