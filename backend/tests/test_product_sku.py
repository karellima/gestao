def test_create_product_rejects_duplicate_sku(client, auth_headers, seed_products):
    response = client.post(
        "/api/products/",
        json={"name": "Produto duplicado", "sku": seed_products[0].sku},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert "SKU já cadastrado" in response.json()["detail"]


def test_update_product_rejects_sku_used_by_another_product(
    client, auth_headers, seed_products,
):
    response = client.put(
        f"/api/products/{seed_products[0].id}",
        json={"sku": seed_products[1].sku},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert "SKU já cadastrado" in response.json()["detail"]


def test_update_product_accepts_keeping_its_own_sku(client, auth_headers, seed_products):
    response = client.put(
        f"/api/products/{seed_products[0].id}",
        json={"sku": seed_products[0].sku},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["sku"] == seed_products[0].sku


def test_create_product_rejects_a_second_empty_sku(client, auth_headers):
    payload = {"name": "Produto sem SKU", "sku": ""}

    first_response = client.post("/api/products/", json=payload, headers=auth_headers)
    second_response = client.post("/api/products/", json=payload, headers=auth_headers)

    assert first_response.status_code == 200
    assert second_response.status_code == 400
    assert "SKU já cadastrado" in second_response.json()["detail"]
