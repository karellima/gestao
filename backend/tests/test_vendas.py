

import pytest

from app.models.sale import Sale
from app.models.stock import StockMovement
from app.services.stock_ledger import recalculate_product_stock


def _seed_stock(db, products, admin):
    for product, quantity in zip(products, (100, 50), strict=True):
        db.add(StockMovement(
            product_id=product.id,
            deposit_id=product.deposit_id,
            movement_type="entrada",
            quantity=quantity,
            unit_price=product.cost_price,
            total_value=quantity * product.cost_price,
            reason="Estoque inicial do teste de venda",
            source="teste",
            user_id=admin.id,
        ))
    db.flush()
    for product in products:
        recalculate_product_stock(db, product.id, commit=False)
    db.commit()


@pytest.fixture()
def stocked_products(db, seed_products, admin):
    _seed_stock(db, seed_products, admin)
    return seed_products


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
    def test_create_sale(
        self, client, auth_headers, seed_products, seed_contacts, seed_sale_types,
        stocked_products,
    ):
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

    def test_create_sale_registra_saidas_e_baixa_estoque(
        self, client, db, admin, seed_products, seed_contacts, seed_sale_types,
    ):
        _seed_stock(db, seed_products, admin)

        response = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [
                {"product_id": seed_products[0].id, "quantity": 2, "unit_price": 50.0},
                {"product_id": seed_products[1].id, "quantity": 1, "unit_price": 100.0},
            ],
        })

        assert response.status_code == 200
        sale_id = response.json()["id"]
        movements = db.query(StockMovement).filter(
            StockMovement.source == "venda",
        ).order_by(StockMovement.id).all()
        assert [(m.product_id, m.movement_type, m.quantity) for m in movements] == [
            (seed_products[0].id, "saida", 2),
            (seed_products[1].id, "saida", 1),
        ]
        assert {m.reason for m in movements} == {f"Venda #{sale_id}"}
        for product in seed_products:
            db.refresh(product)
        assert [product.current_stock for product in seed_products] == [98, 49]

    def test_create_sale_rejeita_soma_dos_itens_acima_do_estoque(
        self, client, db, admin, seed_products, seed_contacts, seed_sale_types,
    ):
        _seed_stock(db, seed_products, admin)

        response = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [
                {"product_id": seed_products[0].id, "quantity": 60, "unit_price": 50},
                {"product_id": seed_products[0].id, "quantity": 41, "unit_price": 50},
            ],
        })

        assert response.status_code == 400
        assert "estoque insuficiente" in response.json()["detail"].lower()
        assert db.query(Sale).count() == 0
        assert db.query(StockMovement).filter(StockMovement.source == "venda").count() == 0
        db.refresh(seed_products[0])
        assert seed_products[0].current_stock == 100

    def test_create_sale_aceita_saldo_fracionario_dentro_da_tolerancia(
        self, client, db, admin, seed_products, seed_contacts, seed_sale_types,
    ):
        product = seed_products[0]
        for movement_type, quantity in (("entrada", 0.3), ("saida", 0.1)):
            db.add(StockMovement(
                product_id=product.id,
                deposit_id=product.deposit_id,
                movement_type=movement_type,
                quantity=quantity,
                unit_price=product.cost_price,
                total_value=quantity * product.cost_price,
                source="teste",
                user_id=admin.id,
            ))
        db.commit()

        response = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [
                {"product_id": product.id, "quantity": 0.2, "unit_price": 50},
            ],
        })

        assert response.status_code == 200
        db.refresh(product)
        assert abs(product.current_stock) <= 1e-6

    def test_update_sale_compensa_saidas_anteriores_sem_apagar_historico(
        self, client, db, admin, seed_products, seed_contacts, seed_sale_types,
    ):
        _seed_stock(db, seed_products, admin)
        created = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [
                {"product_id": seed_products[0].id, "quantity": 2, "unit_price": 50.0},
                {"product_id": seed_products[1].id, "quantity": 1, "unit_price": 100.0},
            ],
        }).json()
        original_ids = {
            movement.id for movement in db.query(StockMovement).filter(
                StockMovement.source == "venda",
            )
        }

        response = client.put(f"/api/sales/{created['id']}", json={
            "items": [
                {"product_id": seed_products[1].id, "quantity": 3, "unit_price": 100.0},
            ],
        })

        assert response.status_code == 200
        all_movements = db.query(StockMovement).order_by(StockMovement.id).all()
        assert original_ids <= {movement.id for movement in all_movements}
        assert original_ids == {
            movement.compensates_movement_id
            for movement in all_movements
            if movement.compensates_movement_id is not None
        }
        for product in seed_products:
            db.refresh(product)
        assert [product.current_stock for product in seed_products] == [100, 47]

    def test_update_sale_sem_estoque_restaura_venda_e_ledger_originais(
        self, client, db, admin, seed_products, seed_contacts, seed_sale_types,
    ):
        _seed_stock(db, seed_products, admin)
        created = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [
                {"product_id": seed_products[0].id, "quantity": 2, "unit_price": 50},
            ],
        }).json()

        response = client.put(f"/api/sales/{created['id']}", json={
            "items": [
                {"product_id": seed_products[0].id, "quantity": 101, "unit_price": 50},
            ],
        })

        assert response.status_code == 400
        db.expire_all()
        sale = db.get(Sale, created["id"])
        assert [(item.product_id, item.quantity) for item in sale.items] == [
            (seed_products[0].id, 2),
        ]
        sale_movements = db.query(StockMovement).filter(
            StockMovement.source == "venda",
        ).all()
        assert len(sale_movements) == 1
        assert sale_movements[0].compensates_movement_id is None
        db.refresh(seed_products[0])
        assert seed_products[0].current_stock == 98

    def test_delete_sale_compensa_saidas_sem_apagar_historico(
        self, client, db, admin, seed_products, seed_contacts, seed_sale_types,
    ):
        _seed_stock(db, seed_products, admin)
        created = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [
                {"product_id": seed_products[0].id, "quantity": 2, "unit_price": 50.0},
                {"product_id": seed_products[1].id, "quantity": 1, "unit_price": 100.0},
            ],
        }).json()
        original_ids = {
            movement.id for movement in db.query(StockMovement).filter(
                StockMovement.source == "venda",
            )
        }

        response = client.delete(f"/api/sales/{created['id']}")

        assert response.status_code == 200
        all_movements = db.query(StockMovement).order_by(StockMovement.id).all()
        assert original_ids <= {movement.id for movement in all_movements}
        assert original_ids == {
            movement.compensates_movement_id
            for movement in all_movements
            if movement.compensates_movement_id is not None
        }
        for product in seed_products:
            db.refresh(product)
        assert [product.current_stock for product in seed_products] == [100, 50]

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

    def test_list_sales(
        self, client, auth_headers, seed_products, seed_contacts, seed_sale_types,
        stocked_products,
    ):
        client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 1, "unit_price": 50.0}],
        }, headers=auth_headers)

        resp = client.get("/api/sales/", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_get_sale(
        self, client, auth_headers, seed_products, seed_contacts, seed_sale_types,
        stocked_products,
    ):
        create_resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 2, "unit_price": 50.0}],
        }, headers=auth_headers)
        sale_id = create_resp.json()["id"]

        resp = client.get(f"/api/sales/{sale_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["total_amount"] == 100.0

    def test_update_sale(
        self, client, auth_headers, seed_products, seed_contacts, seed_sale_types,
        stocked_products,
    ):
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

    def test_delete_sale(
        self, client, auth_headers, seed_products, seed_contacts, seed_sale_types,
        stocked_products,
    ):
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
    def test_price_table_used_for_client_with_table(
        self, client, auth_headers, seed_products, seed_contacts, seed_sale_types,
        db, stocked_products,
    ):
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

    def test_product_not_in_table_falls_back_to_product_price(
        self, client, auth_headers, seed_products, seed_contacts, seed_sale_types,
        db, stocked_products,
    ):
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

    def test_no_price_table_client_uses_sent_price(
        self, client, auth_headers, seed_products, seed_contacts, seed_sale_types,
        stocked_products,
    ):
        resp = client.post("/api/sales/", json={
            "contact_id": seed_contacts[0].id,
            "sale_type_id": seed_sale_types[0].id,
            "items": [{"product_id": seed_products[0].id, "quantity": 2, "unit_price": 50.0}],
        }, headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["items"][0]["unit_price"] == 50.0
