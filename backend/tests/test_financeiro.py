


class TestFinancialTransactions:
    def test_create_receita(self, client, auth_headers, seed_financial_categories):
        resp = client.post("/api/financial/transactions/", json={
            "type": "receita",
            "financial_category_id": seed_financial_categories[0].id,
            "description": "Venda de produtos",
            "amount": 1500.0,
            "date": "2025-01-15T00:00:00",
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["type"] == "receita"
        assert data["amount"] == 1500.0
        assert data["description"] == "Venda de produtos"
        assert data["status"] == "pendente"

    def test_create_despesa(self, client, auth_headers, seed_financial_categories):
        resp = client.post("/api/financial/transactions/", json={
            "type": "despesa",
            "financial_category_id": seed_financial_categories[1].id,
            "description": "Compra de insumos",
            "amount": 800.0,
            "date": "2025-01-10T00:00:00",
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["type"] == "despesa"
        assert data["amount"] == 800.0

    def test_list_transactions(self, client, auth_headers, seed_financial_categories):
        client.post("/api/financial/transactions/", json={
            "type": "receita", "financial_category_id": seed_financial_categories[0].id,
            "description": "T1", "amount": 100.0, "date": "2025-01-01T00:00:00",
        }, headers=auth_headers)
        client.post("/api/financial/transactions/", json={
            "type": "despesa", "financial_category_id": seed_financial_categories[1].id,
            "description": "T2", "amount": 50.0, "date": "2025-01-02T00:00:00",
        }, headers=auth_headers)

        resp = client.get("/api/financial/transactions/", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_transactions_filtered_by_type(self, client, auth_headers, seed_financial_categories):
        client.post("/api/financial/transactions/", json={
            "type": "receita", "financial_category_id": seed_financial_categories[0].id,
            "description": "T1", "amount": 100.0, "date": "2025-01-01T00:00:00",
        }, headers=auth_headers)
        client.post("/api/financial/transactions/", json={
            "type": "despesa", "financial_category_id": seed_financial_categories[1].id,
            "description": "T2", "amount": 50.0, "date": "2025-01-02T00:00:00",
        }, headers=auth_headers)

        resp = client.get("/api/financial/transactions/?type=receita", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["type"] == "receita"

    def test_get_transaction(self, client, auth_headers, seed_financial_categories):
        create_resp = client.post("/api/financial/transactions/", json={
            "type": "receita", "financial_category_id": seed_financial_categories[0].id,
            "description": "T1", "amount": 200.0, "date": "2025-01-01T00:00:00",
        }, headers=auth_headers)
        tx_id = create_resp.json()["id"]

        resp = client.get(f"/api/financial/transactions/{tx_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["amount"] == 200.0

    def test_get_transaction_not_found(self, client, auth_headers):
        resp = client.get("/api/financial/transactions/99999", headers=auth_headers)
        assert resp.status_code == 404

    def test_update_transaction(self, client, auth_headers, seed_financial_categories):
        create_resp = client.post("/api/financial/transactions/", json={
            "type": "receita", "financial_category_id": seed_financial_categories[0].id,
            "description": "T1", "amount": 200.0, "date": "2025-01-01T00:00:00",
        }, headers=auth_headers)
        tx_id = create_resp.json()["id"]

        resp = client.put(f"/api/financial/transactions/{tx_id}", json={
            "amount": 300.0,
            "description": "T1 atualizada",
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["amount"] == 300.0
        assert data["description"] == "T1 atualizada"

    def test_delete_transaction(self, client, auth_headers, seed_financial_categories):
        create_resp = client.post("/api/financial/transactions/", json={
            "type": "receita", "financial_category_id": seed_financial_categories[0].id,
            "description": "T1", "amount": 200.0, "date": "2025-01-01T00:00:00",
        }, headers=auth_headers)
        tx_id = create_resp.json()["id"]

        resp = client.delete(f"/api/financial/transactions/{tx_id}", headers=auth_headers)
        assert resp.status_code == 200

        resp = client.get("/api/financial/transactions/", headers=auth_headers)
        assert len(resp.json()) == 0

    def test_delete_transaction_with_payments(self, client, auth_headers, seed_financial_categories):
        create_resp = client.post("/api/financial/transactions/", json={
            "type": "receita", "financial_category_id": seed_financial_categories[0].id,
            "description": "Venda recebida", "amount": 200.0, "date": "2025-01-01T00:00:00",
        }, headers=auth_headers)
        tx_id = create_resp.json()["id"]
        client.post("/api/payments/", json={
            "transaction_id": tx_id, "amount": 200.0,
            "payment_date": "2025-01-15T00:00:00",
        }, headers=auth_headers)

        resp = client.delete(f"/api/financial/transactions/{tx_id}", headers=auth_headers)

        assert resp.status_code == 200
        assert client.get(f"/api/financial/transactions/{tx_id}", headers=auth_headers).status_code == 404


class TestFinancialPayments:
    def test_create_payment_updates_status(self, client, auth_headers, seed_financial_categories):
        create_resp = client.post("/api/financial/transactions/", json={
            "type": "despesa",
            "financial_category_id": seed_financial_categories[1].id,
            "description": "Compra",
            "amount": 1000.0,
            "date": "2025-01-01T00:00:00",
        }, headers=auth_headers)
        tx_id = create_resp.json()["id"]

        resp = client.post("/api/payments/", json={
            "transaction_id": tx_id,
            "amount": 1000.0,
            "payment_date": "2025-01-15T00:00:00",
        }, headers=auth_headers)

        assert resp.status_code == 200

        tx_resp = client.get(f"/api/financial/transactions/{tx_id}", headers=auth_headers)
        assert tx_resp.json()["status"] == "pago"

    def test_partial_payment_status(self, client, auth_headers, seed_financial_categories):
        create_resp = client.post("/api/financial/transactions/", json={
            "type": "despesa", "financial_category_id": seed_financial_categories[1].id,
            "description": "Compra", "amount": 1000.0, "date": "2025-01-01T00:00:00",
        }, headers=auth_headers)
        tx_id = create_resp.json()["id"]

        client.post("/api/payments/", json={
            "transaction_id": tx_id, "amount": 400.0,
            "payment_date": "2025-01-10T00:00:00",
        }, headers=auth_headers)

        tx_resp = client.get(f"/api/financial/transactions/{tx_id}", headers=auth_headers)
        assert tx_resp.json()["status"] == "pago_parcial"

    def test_receita_payment_status_is_recebido(self, client, auth_headers, seed_financial_categories):
        create_resp = client.post("/api/financial/transactions/", json={
            "type": "receita", "financial_category_id": seed_financial_categories[0].id,
            "description": "Venda", "amount": 500.0, "date": "2025-01-01T00:00:00",
        }, headers=auth_headers)
        tx_id = create_resp.json()["id"]

        client.post("/api/payments/", json={
            "transaction_id": tx_id, "amount": 500.0,
            "payment_date": "2025-01-15T00:00:00",
        }, headers=auth_headers)

        tx_resp = client.get(f"/api/financial/transactions/{tx_id}", headers=auth_headers)
        assert tx_resp.json()["status"] == "recebido"

    def test_payment_exceeds_remaining_balance(self, client, auth_headers, seed_financial_categories):
        create_resp = client.post("/api/financial/transactions/", json={
            "type": "despesa", "financial_category_id": seed_financial_categories[1].id,
            "description": "Compra", "amount": 1000.0, "date": "2025-01-01T00:00:00",
        }, headers=auth_headers)
        tx_id = create_resp.json()["id"]

        resp = client.post("/api/payments/", json={
            "transaction_id": tx_id, "amount": 1500.0,
            "payment_date": "2025-01-15T00:00:00",
        }, headers=auth_headers)

        assert resp.status_code == 400
        assert "excede" in resp.json()["detail"].lower()

    def test_delete_payment_reverts_status(self, client, auth_headers, seed_financial_categories):
        create_resp = client.post("/api/financial/transactions/", json={
            "type": "despesa", "financial_category_id": seed_financial_categories[1].id,
            "description": "Compra", "amount": 1000.0, "date": "2025-01-01T00:00:00",
        }, headers=auth_headers)
        tx_id = create_resp.json()["id"]

        pay_resp = client.post("/api/payments/", json={
            "transaction_id": tx_id, "amount": 1000.0,
            "payment_date": "2025-01-15T00:00:00",
        }, headers=auth_headers)
        pay_id = pay_resp.json()["id"]

        client.delete(f"/api/payments/{pay_id}", headers=auth_headers)

        tx_resp = client.get(f"/api/financial/transactions/{tx_id}", headers=auth_headers)
        assert tx_resp.json()["status"] == "pendente"
