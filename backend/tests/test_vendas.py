

class TestSaleTypes:
    def test_list_sale_types(self, client, auth_headers, seed_sale_types):
        resp = client.get("/api/sale-types/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["name"] == "Venda Direta"

    def test_create_sale_type(self, client, auth_headers):
        resp = client.post("/api/sale-types/", json={
            "name": "Venda Online",
            "description": "Vendas pelo site",
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Venda Online"
        assert data["is_active"] is True

    def test_update_sale_type(self, client, auth_headers, seed_sale_types):
        st_id = seed_sale_types[0].id
        resp = client.put(f"/api/sale-types/{st_id}", json={
            "name": "Venda Direta Atualizada",
        }, headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["name"] == "Venda Direta Atualizada"

    def test_delete_sale_type_soft(self, client, auth_headers, seed_sale_types):
        st_id = seed_sale_types[0].id
        resp = client.delete(f"/api/sale-types/{st_id}", headers=auth_headers)
        assert resp.status_code == 200

        resp = client.get("/api/sale-types/", headers=auth_headers)
        assert len(resp.json()) == 1


class TestSales:
    def test_create_sale(self, client, auth_headers, seed_products, seed_contacts, seed_sale_types):
        resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "notes": "Venda teste",
            "items": [
                {"product_id": seed_products[0].id, "quantity": 2, "unit_price": 50.0},
                {"product_id": seed_products[1].id, "quantity": 1, "unit_price": 100.0},
            ],
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["contact_id"] == seed_contacts[0].id
        assert data["total_amount"] == 200.0
        assert len(data["items"]) == 2

    def test_create_sale_invalid_contact(self, client, auth_headers, seed_products, seed_sale_types):
        resp = client.post("/api/sales/", json={
            "contact_id": 99999,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 1, "unit_price": 50.0}],
        }, headers=auth_headers)

        assert resp.status_code == 400
        assert "cliente" in resp.json()["detail"].lower()

    def test_create_sale_invalid_product(self, client, auth_headers, seed_contacts, seed_sale_types):
        resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": 99999, "quantity": 1, "unit_price": 50.0}],
        }, headers=auth_headers)

        assert resp.status_code == 400
        assert "produto" in resp.json()["detail"].lower()

    def test_list_sales(self, client, auth_headers, seed_products, seed_contacts, seed_sale_types):
        client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 1, "unit_price": 50.0}],
        }, headers=auth_headers)

        resp = client.get("/api/sales/", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_get_sale(self, client, auth_headers, seed_products, seed_contacts, seed_sale_types):
        create_resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 2, "unit_price": 50.0}],
        }, headers=auth_headers)
        sale_id = create_resp.json()["id"]

        resp = client.get(f"/api/sales/{sale_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["total_amount"] == 100.0

    def test_update_sale(self, client, auth_headers, seed_products, seed_contacts, seed_sale_types):
        create_resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 1, "unit_price": 50.0}],
        }, headers=auth_headers)
        sale_id = create_resp.json()["id"]

        resp = client.put(f"/api/sales/{sale_id}", json={
            "items": [{"product_id": seed_products[1].id, "quantity": 3, "unit_price": 100.0}],
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["total_amount"] == 300.0
        assert len(data["items"]) == 1
        assert data["items"][0]["product_id"] == seed_products[1].id

    def test_delete_sale(self, client, auth_headers, seed_products, seed_contacts, seed_sale_types):
        create_resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 1, "unit_price": 50.0}],
        }, headers=auth_headers)
        sale_id = create_resp.json()["id"]

        resp = client.delete(f"/api/sales/{sale_id}", headers=auth_headers)
        assert resp.status_code == 200

        resp = client.get("/api/sales/", headers=auth_headers)
        assert len(resp.json()) == 0


class TestPriceTableResolution:
    def test_price_table_used_for_client_with_table(self, client, auth_headers, seed_products, seed_contacts, seed_sale_types, db):
        from app.models.price_table import PriceTable, PriceTableItem
        table = PriceTable(name="Tabela VIP", is_active=True)
        db.add(table)
        db.flush()

        db.add(PriceTableItem(price_table_id=table.id, product_id=seed_products[0].id, price=35.0))
        db.commit()

        seed_contacts[0].price_table_id = table.id
        db.commit()

        resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 10, "unit_price": 50.0}],
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["total_amount"] == 350.0
        assert data["items"][0]["unit_price"] == 35.0

    def test_product_not_in_table_falls_back_to_product_price(self, client, auth_headers, seed_products, seed_contacts, seed_sale_types, db):
        from app.models.price_table import PriceTable, PriceTableItem
        table = PriceTable(name="Tabela Parcial", is_active=True)
        db.add(table)
        db.flush()

        db.add(PriceTableItem(price_table_id=table.id, product_id=seed_products[0].id, price=35.0))
        db.commit()

        seed_contacts[0].price_table_id = table.id
        db.commit()

        resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[1].id, "quantity": 1, "unit_price": 100.0}],
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["total_amount"] == 100.0
        assert data["items"][0]["unit_price"] == 100.0

    def test_no_price_table_client_uses_sent_price(self, client, auth_headers, seed_products, seed_contacts, seed_sale_types):
        resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 2, "unit_price": 50.0}],
        }, headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["items"][0]["unit_price"] == 50.0
