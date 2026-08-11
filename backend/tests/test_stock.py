import pytest


class TestStockMovements:
    def test_create_entrada(self, client, auth_headers, seed_products, seed_deposits):
        resp = client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 10,
            "unit_price": 50.0,
            "reason": "Compra",
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["product_id"] == seed_products[0].id
        assert data["quantity"] == 10
        assert data["movement_type"] == "entrada"
        assert data["total_value"] == 500.0

    def test_create_saida_requires_reason(self, client, auth_headers, seed_products, seed_deposits):
        resp = client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "saida",
            "quantity": 5,
            "unit_price": 50.0,
        }, headers=auth_headers)

        assert resp.status_code == 400
        assert "motivo" in resp.json()["detail"].lower()

    def test_create_saida_with_reason(self, client, auth_headers, seed_products, seed_deposits):
        resp = client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "saida",
            "quantity": 5,
            "unit_price": 50.0,
            "reason": "Venda",
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["movement_type"] == "saida"
        assert data["reason"] == "Venda"

    def test_stock_recalculated_after_movement(self, client, auth_headers, seed_products, seed_deposits, db):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 100,
            "unit_price": 30.0,
            "reason": "Estoque inicial",
        }, headers=auth_headers)

        db.refresh(seed_products[0])
        assert seed_products[0].current_stock == 100

        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "saida",
            "quantity": 20,
            "unit_price": 50.0,
            "reason": "Venda",
        }, headers=auth_headers)

        db.refresh(seed_products[0])
        assert seed_products[0].current_stock == 80

    def test_list_movements_filtered(self, client, auth_headers, seed_products, seed_deposits):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 15,
            "unit_price": 30.0,
            "reason": "Compra",
        }, headers=auth_headers)

        resp = client.get(f"/api/stock/movements/?product_id={seed_products[0].id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["product_id"] == seed_products[0].id

        resp = client.get("/api/stock/movements/?movement_type=entrada", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_update_movement(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 10,
            "unit_price": 30.0,
            "reason": "Compra",
        }, headers=auth_headers)
        mov_id = create_resp.json()["id"]

        resp = client.put(f"/api/stock/movements/{mov_id}", json={
            "quantity": 20,
            "unit_price": 35.0,
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["quantity"] == 20
        assert data["total_value"] == 700.0

    def test_delete_movement(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 10,
            "unit_price": 30.0,
            "reason": "Compra",
        }, headers=auth_headers)
        mov_id = create_resp.json()["id"]

        resp = client.delete(f"/api/stock/movements/{mov_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["message"] == "Movimentação estornada"

        resp = client.get(f"/api/stock/movements/?product_id={seed_products[0].id}", headers=auth_headers)
        assert len(resp.json()) == 2
        assert any(item["id"] == mov_id for item in resp.json())
        assert any(item["compensates_movement_id"] == mov_id for item in resp.json())

    def test_cannot_edit_requisition_movement(self, client, auth_headers, seed_products, seed_deposits, db):
        from app.models.stock import StockMovement
        mov = StockMovement(
            product_id=seed_products[0].id,
            deposit_id=seed_deposits[0].id,
            movement_type="saida",
            quantity=5,
            unit_price=50.0,
            total_value=250.0,
            reason="Requisição #1: teste",
            source="requisicao",
            user_id=1,
        )
        db.add(mov)
        db.commit()
        db.refresh(mov)

        resp = client.put(f"/api/stock/movements/{mov.id}", json={
            "quantity": 10,
        }, headers=auth_headers)

        assert resp.status_code == 400
        assert "requisição" in resp.json()["detail"].lower()

    def test_cannot_delete_requisition_movement(self, client, auth_headers, seed_products, seed_deposits, db):
        from app.models.stock import StockMovement
        mov = StockMovement(
            product_id=seed_products[0].id,
            deposit_id=seed_deposits[0].id,
            movement_type="saida",
            quantity=5,
            unit_price=50.0,
            total_value=250.0,
            reason="Requisição #1: teste",
            source="requisicao",
            user_id=1,
        )
        db.add(mov)
        db.commit()
        db.refresh(mov)

        resp = client.delete(f"/api/stock/movements/{mov.id}", headers=auth_headers)
        assert resp.status_code == 400
        assert "requisição" in resp.json()["detail"].lower()


class TestStockBalance:
    def test_balance(self, client, auth_headers, seed_products, seed_deposits):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 50,
            "unit_price": 30.0,
            "reason": "Compra",
        }, headers=auth_headers)

        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "saida",
            "quantity": 20,
            "unit_price": 50.0,
            "reason": "Venda",
        }, headers=auth_headers)

        resp = client.get("/api/stock/balance/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        item = [d for d in data if d["product_id"] == seed_products[0].id][0]
        assert item["quantity_entries"] == 50
        assert item["quantity_exits"] == 20
        assert item["balance"] == 30


class TestStockTransfer:
    def test_transfer_abastecimento(self, client, auth_headers, seed_products, seed_deposits):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 100,
            "unit_price": 30.0,
            "reason": "Compra inicial",
        }, headers=auth_headers)

        resp = client.post("/api/stock/transfer", json={
            "source_deposit_id": seed_deposits[0].id,
            "destination_deposit_id": seed_deposits[1].id,
            "transfer_type": "abastecimento",
            "items": [{"product_id": seed_products[0].id, "quantity": 30}],
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["items_count"] == 1

        resp = client.get(f"/api/stock/movements/?product_id={seed_products[0].id}", headers=auth_headers)
        movements = resp.json()
        saidas = [m for m in movements if m["movement_type"] == "saida" and "abastecimento" in (m["reason"] or "").lower()]
        entradas = [m for m in movements if m["movement_type"] == "entrada" and "abastecimento" in (m["reason"] or "").lower()]
        assert len(saidas) == 1
        assert len(entradas) == 1

    def test_transfer_same_deposit_rejected(self, client, auth_headers, seed_products, seed_deposits):
        resp = client.post("/api/stock/transfer", json={
            "source_deposit_id": seed_deposits[0].id,
            "destination_deposit_id": seed_deposits[0].id,
            "transfer_type": "abastecimento",
            "items": [{"product_id": seed_products[0].id, "quantity": 10}],
        }, headers=auth_headers)

        assert resp.status_code == 400

    def test_transfer_insufficient_stock(self, client, auth_headers, seed_products, seed_deposits):
        resp = client.post("/api/stock/transfer", json={
            "source_deposit_id": seed_deposits[0].id,
            "destination_deposit_id": seed_deposits[1].id,
            "transfer_type": "abastecimento",
            "items": [{"product_id": seed_products[0].id, "quantity": 9999}],
        }, headers=auth_headers)

        assert resp.status_code == 400
        assert "insuficiente" in resp.json()["detail"].lower()


class TestStockAvaria:
    def test_register_avaria(self, client, auth_headers, seed_products, seed_deposits):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 100,
            "unit_price": 30.0,
            "reason": "Compra inicial",
        }, headers=auth_headers)

        resp = client.post("/api/stock/avaria", json={
            "deposit_id": seed_deposits[0].id,
            "description": "Produto danificado no transporte",
            "items": [{"product_id": seed_products[0].id, "quantity": 5}],
        }, headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["items_count"] == 1

    def test_avaria_exceeds_stock(self, client, auth_headers, seed_products, seed_deposits):
        resp = client.post("/api/stock/avaria", json={
            "deposit_id": seed_deposits[0].id,
            "description": "Danos diversos",
            "items": [{"product_id": seed_products[0].id, "quantity": 9999}],
        }, headers=auth_headers)

        assert resp.status_code == 400
        assert "excede" in resp.json()["detail"].lower()
