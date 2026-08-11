import pytest
from app.models.stock import StockMovement


class TestRequisicaoWorkflow:
    def test_create_requisicao(self, client, auth_headers, seed_products, seed_deposits):
        resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "reason": "Necessidade de estoque",
            "notes": "Urgente",
            "items": [
                {"product_id": seed_products[0].id, "quantity_requested": 20, "unit_price": 30.0},
                {"product_id": seed_products[1].id, "quantity_requested": 10, "unit_price": 60.0},
            ],
        }, headers=auth_headers)

        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "pendente"
        assert data["reason"] == "Necessidade de estoque"
        assert len(data["items"]) == 2
        assert data["requester_name"] is not None

    def test_create_requisicao_no_items(self, client, auth_headers, seed_deposits):
        resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [],
        }, headers=auth_headers)

        assert resp.status_code == 400

    def test_list_requisicoes(self, client, auth_headers, seed_products, seed_deposits):
        client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "reason": "Req 1",
            "items": [{"product_id": seed_products[0].id, "quantity_requested": 5}],
        }, headers=auth_headers)

        client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "reason": "Req 2",
            "items": [{"product_id": seed_products[1].id, "quantity_requested": 3}],
        }, headers=auth_headers)

        resp = client.get("/api/requisicoes/", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_filter_requisicoes_by_status(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity_requested": 5}],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        resp = client.get("/api/requisicoes/?status=pendente", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        resp = client.get("/api/requisicoes/?status=aprovado", headers=auth_headers)
        assert len(resp.json()) == 0

    def test_update_requisicao_pendente(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "reason": "Original",
            "items": [{"product_id": seed_products[0].id, "quantity_requested": 5}],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        resp = client.put(f"/api/requisicoes/{req_id}", json={
            "reason": "Atualizada",
            "notes": "Nova nota",
        }, headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["reason"] == "Atualizada"
        assert resp.json()["notes"] == "Nova nota"

    def test_delete_requisicao_pendente(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity_requested": 5}],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        resp = client.delete(f"/api/requisicoes/{req_id}", headers=auth_headers)
        assert resp.status_code == 200

        resp = client.get("/api/requisicoes/", headers=auth_headers)
        assert len(resp.json()) == 0

    def test_approve_requisicao(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [
                {"product_id": seed_products[0].id, "quantity_requested": 30},
                {"product_id": seed_products[1].id, "quantity_requested": 15},
            ],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        resp = client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [
                {"product_id": seed_products[0].id, "quantity_approved": 25},
                {"product_id": seed_products[1].id, "quantity_approved": 10},
            ],
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "aprovado"
        assert data["approver_id"] is not None

        item0 = [it for it in data["items"] if it["product_id"] == seed_products[0].id][0]
        item1 = [it for it in data["items"] if it["product_id"] == seed_products[1].id][0]
        assert item0["quantity_approved"] == 25
        assert item1["quantity_approved"] == 10

    def test_cannot_approve_non_pendente(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity_requested": 5}],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [{"product_id": seed_products[0].id, "quantity_approved": 5}],
        }, headers=auth_headers)

        resp = client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [{"product_id": seed_products[0].id, "quantity_approved": 5}],
        }, headers=auth_headers)

        assert resp.status_code == 400

    def test_fulfill_requisicao(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [
                {"product_id": seed_products[0].id, "quantity_requested": 20},
            ],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [{"product_id": seed_products[0].id, "quantity_approved": 15}],
        }, headers=auth_headers)

        resp = client.put(f"/api/requisicoes/{req_id}/fulfill", json={
            "items": [{"product_id": seed_products[0].id, "quantity_fulfilled": 15}],
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "atendido"
        item = data["items"][0]
        assert item["quantity_fulfilled"] == 15

    def test_cannot_fulfill_non_approved(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity_requested": 5}],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        resp = client.put(f"/api/requisicoes/{req_id}/fulfill", json={
            "items": [{"product_id": seed_products[0].id, "quantity_fulfilled": 5}],
        }, headers=auth_headers)

        assert resp.status_code == 400

    def test_receive_requisicao_creates_stock_movements(self, client, auth_headers, seed_products, seed_deposits):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 100,
            "unit_price": 30.0,
            "reason": "Estoque inicial",
        }, headers=auth_headers)

        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [
                {"product_id": seed_products[0].id, "quantity_requested": 30, "unit_price": 30.0},
            ],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [{"product_id": seed_products[0].id, "quantity_approved": 20}],
        }, headers=auth_headers)

        client.put(f"/api/requisicoes/{req_id}/fulfill", json={
            "items": [{"product_id": seed_products[0].id, "quantity_fulfilled": 20}],
        }, headers=auth_headers)

        resp = client.put(f"/api/requisicoes/{req_id}/receive", json={
            "items": [{"product_id": seed_products[0].id, "quantity_received": 18}],
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "recebido"

        item = data["items"][0]
        assert item["quantity_received"] == 18

        movements = client.get(f"/api/stock/movements/?product_id={seed_products[0].id}", headers=auth_headers).json()
        saidas = [m for m in movements if m["movement_type"] == "saida" and m["source"] == "requisicao"]
        entradas = [m for m in movements if m["movement_type"] == "entrada" and m["source"] == "requisicao"]
        assert len(saidas) == 1
        assert len(entradas) == 1
        assert saidas[0]["deposit_id"] == seed_deposits[0].id
        assert entradas[0]["deposit_id"] == seed_deposits[1].id

    def test_baixa_apenas_no_recebimento(self, client, auth_headers, seed_products, seed_deposits):
        """Checks that stock exits are only created at receipt, not at approval or fulfillment."""
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 100,
            "unit_price": 30.0,
            "reason": "Estoque inicial",
        }, headers=auth_headers)

        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [
                {"product_id": seed_products[0].id, "quantity_requested": 30, "unit_price": 30.0},
            ],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [{"product_id": seed_products[0].id, "quantity_approved": 20}],
        }, headers=auth_headers)

        movements_after_approve = client.get(
            f"/api/stock/movements/?product_id={seed_products[0].id}", headers=auth_headers
        ).json()
        req_saidas = [m for m in movements_after_approve if m.get("source") == "requisicao" and m["movement_type"] == "saida"]
        assert len(req_saidas) == 0, "Não deve haver movimentos de saída após aprovação"

        client.put(f"/api/requisicoes/{req_id}/fulfill", json={
            "items": [{"product_id": seed_products[0].id, "quantity_fulfilled": 20}],
        }, headers=auth_headers)

        movements_after_fulfill = client.get(
            f"/api/stock/movements/?product_id={seed_products[0].id}", headers=auth_headers
        ).json()
        req_saidas = [m for m in movements_after_fulfill if m.get("source") == "requisicao" and m["movement_type"] == "saida"]
        assert len(req_saidas) == 0, "Não deve haver movimentos de saída após atendimento"

        client.put(f"/api/requisicoes/{req_id}/receive", json={
            "items": [{"product_id": seed_products[0].id, "quantity_received": 20}],
        }, headers=auth_headers)

        movements_after_receive = client.get(
            f"/api/stock/movements/?product_id={seed_products[0].id}", headers=auth_headers
        ).json()
        req_saidas = [m for m in movements_after_receive if m.get("source") == "requisicao" and m["movement_type"] == "saida"]
        req_entradas = [m for m in movements_after_receive if m.get("source") == "requisicao" and m["movement_type"] == "entrada"]
        assert len(req_saidas) == 1, "A saída do estoque deve ser criada apenas no recebimento"
        assert len(req_entradas) == 1
        assert req_saidas[0]["deposit_id"] == seed_deposits[0].id
        assert req_entradas[0]["deposit_id"] == seed_deposits[1].id

    def test_receive_partial(self, client, auth_headers, seed_products, seed_deposits):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 100,
            "unit_price": 30.0,
            "reason": "Estoque inicial",
        }, headers=auth_headers)

        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [
                {"product_id": seed_products[0].id, "quantity_requested": 30, "unit_price": 30.0},
            ],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [{"product_id": seed_products[0].id, "quantity_approved": 20}],
        }, headers=auth_headers)

        client.put(f"/api/requisicoes/{req_id}/fulfill", json={
            "items": [{"product_id": seed_products[0].id, "quantity_fulfilled": 20}],
        }, headers=auth_headers)

        resp = client.put(f"/api/requisicoes/{req_id}/receive", json={
            "items": [{"product_id": seed_products[0].id, "quantity_received": 10}],
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "recebido"
        item = data["items"][0]
        assert item["quantity_received"] == 10

    def test_receive_cannot_exceed_fulfilled(self, client, auth_headers, seed_products, seed_deposits):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 100,
            "unit_price": 30.0,
            "reason": "Estoque inicial",
        }, headers=auth_headers)

        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [
                {"product_id": seed_products[0].id, "quantity_requested": 30, "unit_price": 30.0},
            ],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [{"product_id": seed_products[0].id, "quantity_approved": 15}],
        }, headers=auth_headers)

        client.put(f"/api/requisicoes/{req_id}/fulfill", json={
            "items": [{"product_id": seed_products[0].id, "quantity_fulfilled": 15}],
        }, headers=auth_headers)

        resp = client.put(f"/api/requisicoes/{req_id}/receive", json={
            "items": [{"product_id": seed_products[0].id, "quantity_received": 99}],
        }, headers=auth_headers)

        assert resp.status_code == 400
        assert "exceder" in resp.json()["detail"].lower()

    def test_cancel_requisicao(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity_requested": 5}],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        resp = client.put(f"/api/requisicoes/{req_id}/cancel", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelado"

    def test_cannot_cancel_received_requisicao(self, client, auth_headers, seed_products, seed_deposits):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 100,
            "unit_price": 30.0,
            "reason": "Estoque inicial",
        }, headers=auth_headers)

        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity_requested": 10}],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [{"product_id": seed_products[0].id, "quantity_approved": 10}],
        }, headers=auth_headers)
        client.put(f"/api/requisicoes/{req_id}/fulfill", json={
            "items": [{"product_id": seed_products[0].id, "quantity_fulfilled": 10}],
        }, headers=auth_headers)
        client.put(f"/api/requisicoes/{req_id}/receive", json={
            "items": [{"product_id": seed_products[0].id, "quantity_received": 10}],
        }, headers=auth_headers)

        resp = client.put(f"/api/requisicoes/{req_id}/cancel", headers=auth_headers)
        assert resp.status_code == 400

    def test_cannot_update_non_pendente(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity_requested": 5}],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [{"product_id": seed_products[0].id, "quantity_approved": 5}],
        }, headers=auth_headers)

        resp = client.put(f"/api/requisicoes/{req_id}", json={
            "reason": "Deveria falhar",
        }, headers=auth_headers)

        assert resp.status_code == 400

    def test_cannot_delete_approved_requisicao(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity_requested": 5}],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [{"product_id": seed_products[0].id, "quantity_approved": 5}],
        }, headers=auth_headers)

        resp = client.delete(f"/api/requisicoes/{req_id}", headers=auth_headers)
        assert resp.status_code == 400

    def test_delete_cancelada_requisicao(self, client, auth_headers, seed_products, seed_deposits):
        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity_requested": 5}],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]

        client.put(f"/api/requisicoes/{req_id}/cancel", headers=auth_headers)

        resp = client.delete(f"/api/requisicoes/{req_id}", headers=auth_headers)
        assert resp.status_code == 200

    def test_end_to_end_requisition_flow(self, client, auth_headers, seed_products, seed_deposits):
        """Full workflow: create -> approve -> fulfill -> receive."""
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 200,
            "unit_price": 25.0,
            "reason": "Estoque inicial",
        }, headers=auth_headers)

        create_resp = client.post("/api/requisicoes/", json={
            "deposit_requesting_id": seed_deposits[1].id,
            "deposit_fulfilling_id": seed_deposits[0].id,
            "reason": "Abastecimento filial",
            "items": [
                {"product_id": seed_products[0].id, "quantity_requested": 50, "unit_price": 25.0},
                {"product_id": seed_products[1].id, "quantity_requested": 25, "unit_price": 55.0},
            ],
        }, headers=auth_headers)
        req_id = create_resp.json()["id"]
        assert create_resp.json()["status"] == "pendente"

        app_resp = client.put(f"/api/requisicoes/{req_id}/approve", json={
            "items": [
                {"product_id": seed_products[0].id, "quantity_approved": 40},
                {"product_id": seed_products[1].id, "quantity_approved": 20},
            ],
        }, headers=auth_headers)
        assert app_resp.json()["status"] == "aprovado"

        ful_resp = client.put(f"/api/requisicoes/{req_id}/fulfill", json={
            "items": [
                {"product_id": seed_products[0].id, "quantity_fulfilled": 40},
                {"product_id": seed_products[1].id, "quantity_fulfilled": 20},
            ],
        }, headers=auth_headers)
        assert ful_resp.json()["status"] == "atendido"

        rec_resp = client.put(f"/api/requisicoes/{req_id}/receive", json={
            "items": [
                {"product_id": seed_products[0].id, "quantity_received": 40},
                {"product_id": seed_products[1].id, "quantity_received": 18},
            ],
        }, headers=auth_headers)
        assert rec_resp.json()["status"] == "recebido"

        movements = client.get("/api/stock/movements/", headers=auth_headers).json()
        req_entradas = [m for m in movements if m["source"] == "requisicao" and m["movement_type"] == "entrada"]
        req_saidas = [m for m in movements if m["source"] == "requisicao" and m["movement_type"] == "saida"]
        assert len(req_saidas) == 2
        assert len(req_entradas) == 2
