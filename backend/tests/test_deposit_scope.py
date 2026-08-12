

from app.models.stock import StockMovement


def _add_stock(db, product, quantity=100):
    db.add(StockMovement(
        product_id=product.id,
        deposit_id=product.deposit_id,
        movement_type="entrada",
        quantity=quantity,
        unit_price=product.cost_price or 0,
        total_value=quantity * (product.cost_price or 0),
        source="teste",
    ))
    db.commit()


class TestDepositScopeStock:
    def test_operador_only_sees_own_deposit_movements(
        self, client, operador_headers, auth_headers, seed_products, seed_deposits,
    ):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 50,
            "unit_price": 30.0,
            "reason": "Compra dep central",
        }, headers=auth_headers)

        client.post("/api/stock/movements/", json={
            "product_id": seed_products[1].id,
            "deposit_id": seed_deposits[1].id,
            "movement_type": "entrada",
            "quantity": 30,
            "unit_price": 60.0,
            "reason": "Compra dep filial",
        }, headers=auth_headers)

        resp = client.get("/api/stock/movements/", headers=operador_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["deposit_id"] == seed_deposits[0].id

    def test_operador_cannot_create_movement_on_other_deposit(
        self, client, operador_headers, seed_products, seed_deposits,
    ):
        resp = client.post("/api/stock/movements/", json={
            "product_id": seed_products[1].id,
            "deposit_id": seed_deposits[1].id,
            "movement_type": "entrada",
            "quantity": 10,
            "unit_price": 30.0,
            "reason": "Compra",
        }, headers=operador_headers)

        assert resp.status_code == 403

    def test_operador_cannot_update_movement_on_other_deposit(
        self, client, operador_headers, seed_products, seed_deposits, db,
    ):
        from app.models.stock import StockMovement
        mov = StockMovement(
            product_id=seed_products[1].id,
            deposit_id=seed_deposits[1].id,
            movement_type="entrada",
            quantity=10,
            unit_price=30.0,
            total_value=300.0,
            reason="Compra",
            user_id=1,
        )
        db.add(mov)
        db.commit()
        db.refresh(mov)

        resp = client.put(f"/api/stock/movements/{mov.id}", json={
            "quantity": 20,
        }, headers=operador_headers)

        assert resp.status_code == 403

    def test_operador_cannot_delete_movement_on_other_deposit(
        self, client, operador_headers, seed_products, seed_deposits, db,
    ):
        from app.models.stock import StockMovement
        mov = StockMovement(
            product_id=seed_products[1].id,
            deposit_id=seed_deposits[1].id,
            movement_type="entrada",
            quantity=10,
            unit_price=30.0,
            total_value=300.0,
            reason="Compra",
            user_id=1,
        )
        db.add(mov)
        db.commit()
        db.refresh(mov)

        resp = client.delete(f"/api/stock/movements/{mov.id}", headers=operador_headers)
        assert resp.status_code == 403

    def test_operador_balance_only_own_deposit(
        self, client, operador_headers, auth_headers, seed_products, seed_deposits,
    ):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 100,
            "unit_price": 30.0,
            "reason": "Compra central",
        }, headers=auth_headers)

        client.post("/api/stock/movements/", json={
            "product_id": seed_products[1].id,
            "deposit_id": seed_deposits[1].id,
            "movement_type": "entrada",
            "quantity": 200,
            "unit_price": 60.0,
            "reason": "Compra filial",
        }, headers=auth_headers)

        resp = client.get("/api/stock/balance/", headers=operador_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1

    def test_operador_transfer_needs_both_deposits(
        self, client, operador_headers, seed_products, seed_deposits,
    ):
        resp = client.post("/api/stock/transfer", json={
            "source_deposit_id": seed_deposits[1].id,
            "destination_deposit_id": seed_deposits[0].id,
            "transfer_type": "abastecimento",
            "items": [{"product_id": seed_products[0].id, "quantity": 10}],
        }, headers=operador_headers)

        assert resp.status_code == 403

    def test_operador_avaria_only_own_deposit(
        self, client, operador_headers, seed_products, seed_deposits,
    ):
        resp = client.post("/api/stock/avaria", json={
            "deposit_id": seed_deposits[1].id,
            "description": "Danos",
            "items": [{"product_id": seed_products[0].id, "quantity": 1}],
        }, headers=operador_headers)

        assert resp.status_code == 403


class TestDepositScopeProducts:
    def test_operador_only_sees_own_deposit_products(
        self, client, operador_headers, seed_products, seed_deposits, db,
    ):
        from app.models.product import Product
        p = Product(
            name="Produto Filial", price=30.0, cost_price=20.0, sku="FIL001",
            deposit_id=seed_deposits[1].id,
        )
        db.add(p)
        db.commit()

        resp = client.get("/api/products/", headers=operador_headers)
        assert resp.status_code == 200
        data = resp.json()
        product_ids = [d["id"] for d in data]
        assert seed_products[0].id in product_ids
        assert p.id not in product_ids

    def test_operador_cannot_get_product_from_other_deposit(
        self, client, operador_headers, seed_products, seed_deposits, db,
    ):
        from app.models.product import Product
        p = Product(
            name="Produto Filial", price=30.0, cost_price=20.0, sku="FIL002",
            deposit_id=seed_deposits[1].id,
        )
        db.add(p)
        db.commit()

        resp = client.get(f"/api/products/{p.id}", headers=operador_headers)
        assert resp.status_code == 404

    def test_operador_can_get_own_deposit_product(
        self, client, operador_headers, seed_products,
    ):
        resp = client.get(f"/api/products/{seed_products[0].id}", headers=operador_headers)
        assert resp.status_code == 200

    def test_operador_cannot_create_product_on_other_deposit(
        self, client, operador_headers, seed_products, seed_deposits,
    ):
        resp = client.post("/api/products/", json={
            "name": "Produto Novo",
            "sku": "NOVO001",
            "price": 40.0,
            "deposit_id": seed_deposits[1].id,
        }, headers=operador_headers)

        assert resp.status_code == 403

    def test_operador_cannot_update_product_on_other_deposit(
        self, client, operador_headers, seed_products, seed_deposits, db,
    ):
        from app.models.product import Product
        p = Product(
            name="Produto Filial", price=30.0, cost_price=20.0, sku="FIL003",
            deposit_id=seed_deposits[1].id,
        )
        db.add(p)
        db.commit()

        resp = client.put(f"/api/products/{p.id}", json={
            "name": "Atualizado",
        }, headers=operador_headers)

        assert resp.status_code == 403

    def test_operador_cannot_delete_product_on_other_deposit(
        self, client, operador_headers, seed_products, seed_deposits, db,
    ):
        from app.models.product import Product
        p = Product(
            name="Produto Filial", price=30.0, cost_price=20.0, sku="FIL004",
            deposit_id=seed_deposits[1].id,
        )
        db.add(p)
        db.commit()

        resp = client.delete(f"/api/products/{p.id}", headers=operador_headers)
        assert resp.status_code == 403


class TestDepositScopeSales:
    def test_operador_only_sees_sales_with_own_deposit_products(
        self, client, operador_headers, auth_headers, seed_products, seed_deposits, seed_contacts, seed_sale_types, db,
    ):
        from app.models.product import Product

        p_filial = Product(
            name="Produto Filial Venda", price=30.0, cost_price=20.0, sku="VFIL001",
            deposit_id=seed_deposits[1].id,
        )
        db.add(p_filial)
        db.commit()
        _add_stock(db, seed_products[0])
        _add_stock(db, p_filial)

        client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 1, "unit_price": 50.0}],
        }, headers=auth_headers)

        client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": p_filial.id, "quantity": 1, "unit_price": 30.0}],
        }, headers=auth_headers)

        resp = client.get("/api/sales/", headers=operador_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1

    def test_operador_cannot_create_sale_with_other_deposit_product(
        self, client, operador_headers, seed_products, seed_contacts, seed_sale_types, seed_deposits, db,
    ):
        from app.models.product import Product
        p_filial = Product(
            name="Produto Filial Venda2", price=30.0, cost_price=20.0, sku="VFIL002",
            deposit_id=seed_deposits[1].id,
        )
        db.add(p_filial)
        db.commit()

        resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": p_filial.id, "quantity": 1, "unit_price": 30.0}],
        }, headers=operador_headers)

        assert resp.status_code == 403

    def test_operador_can_create_sale_with_own_deposit_product(
        self, client, operador_headers, seed_products, seed_contacts, seed_sale_types, db,
    ):
        _add_stock(db, seed_products[0])
        resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 1, "unit_price": 50.0}],
        }, headers=operador_headers)

        assert resp.status_code == 200

    def test_operador_cannot_delete_other_deposit_sale(
        self, client, operador_headers, auth_headers, seed_products, seed_contacts, seed_sale_types, seed_deposits, db,
    ):
        from app.models.product import Product
        p_filial = Product(
            name="Produto Filial Venda3", price=30.0, cost_price=20.0, sku="VFIL003",
            deposit_id=seed_deposits[1].id,
        )
        db.add(p_filial)
        db.commit()
        _add_stock(db, p_filial)

        create_resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": p_filial.id, "quantity": 1, "unit_price": 30.0}],
        }, headers=auth_headers)
        sale_id = create_resp.json()["id"]

        resp = client.delete(f"/api/sales/{sale_id}", headers=operador_headers)
        assert resp.status_code == 403


class TestDepositScopeDeposits:
    def test_operador_only_sees_own_deposits(
        self, client, operador_headers, seed_deposits,
    ):
        resp = client.get("/api/deposits/", headers=operador_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == seed_deposits[0].id

    def test_operador_cannot_get_other_deposit(
        self, client, operador_headers, seed_deposits,
    ):
        resp = client.get(f"/api/deposits/{seed_deposits[1].id}", headers=operador_headers)
        assert resp.status_code == 404

    def test_operador_can_get_own_deposit(
        self, client, operador_headers, seed_deposits,
    ):
        resp = client.get(f"/api/deposits/{seed_deposits[0].id}", headers=operador_headers)
        assert resp.status_code == 200


class TestDepositScopeReports:
    def test_operador_dashboard_only_own_deposit_products(
        self, client, operador_headers, seed_products, seed_deposits, db,
    ):
        from app.models.product import Product
        p = Product(
            name="Produto Filial Dash", price=30.0, cost_price=20.0, sku="DASH001",
            deposit_id=seed_deposits[1].id,
        )
        db.add(p)
        db.commit()

        resp = client.get("/api/reports/dashboard", headers=operador_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_products"] == 2

    def test_admin_dashboard_sees_all_products(
        self, client, auth_headers, seed_products, seed_deposits, db,
    ):
        from app.models.product import Product
        p = Product(
            name="Produto Filial Dash2", price=30.0, cost_price=20.0, sku="DASH002",
            deposit_id=seed_deposits[1].id,
        )
        db.add(p)
        db.commit()

        resp = client.get("/api/reports/dashboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_products"] == 3

    def test_operador_stock_summary_only_own_deposit(
        self, client, operador_headers, auth_headers, seed_products, seed_deposits,
    ):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 100,
            "unit_price": 30.0,
            "reason": "Compra central",
        }, headers=auth_headers)

        client.post("/api/stock/movements/", json={
            "product_id": seed_products[1].id,
            "deposit_id": seed_deposits[1].id,
            "movement_type": "entrada",
            "quantity": 200,
            "unit_price": 60.0,
            "reason": "Compra filial",
        }, headers=auth_headers)

        resp = client.get("/api/reports/stock-movements-summary?days=365", headers=operador_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_entradas"] == 100.0

    def test_admin_stock_summary_sees_all(
        self, client, auth_headers, seed_products, seed_deposits,
    ):
        client.post("/api/stock/movements/", json={
            "product_id": seed_products[0].id,
            "deposit_id": seed_deposits[0].id,
            "movement_type": "entrada",
            "quantity": 100,
            "unit_price": 30.0,
            "reason": "Compra central",
        }, headers=auth_headers)

        client.post("/api/stock/movements/", json={
            "product_id": seed_products[1].id,
            "deposit_id": seed_deposits[1].id,
            "movement_type": "entrada",
            "quantity": 200,
            "unit_price": 60.0,
            "reason": "Compra filial",
        }, headers=auth_headers)

        resp = client.get("/api/reports/stock-movements-summary?days=365", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_entradas"] == 300.0
