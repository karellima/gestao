import logging


def test_health_confirms_database_is_accessible(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["database"] == "ok"
    assert len(response.headers["x-request-id"]) == 6


def test_unhandled_error_returns_reference_id_and_logs_stacktrace(caplog):
    from app.main import app
    from fastapi.testclient import TestClient

    def raise_error():
        raise RuntimeError("falha de teste")

    app.add_api_route("/api/_test-unhandled", raise_error, methods=["GET"])
    route = app.router.routes[-1]
    app.router.routes.remove(route)
    app.router.routes.insert(0, route)
    app.middleware_stack = None
    try:
        with caplog.at_level(logging.ERROR, logger="gestao.main"):
            with TestClient(app, raise_server_exceptions=False) as test_client:
                response = test_client.get("/api/_test-unhandled")
    finally:
        app.router.routes.remove(route)
        app.middleware_stack = None

    reference_id = response.json()["reference_id"]
    assert response.status_code == 500
    assert len(reference_id) == 6
    assert response.headers["x-request-id"] == reference_id
    assert any(
        record.reference_id == reference_id and record.exc_info
        for record in caplog.records
        if record.name == "gestao.main"
    )
