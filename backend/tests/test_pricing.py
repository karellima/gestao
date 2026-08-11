from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.models.pricing import ProductPricing
from app.routers.pricing import _unit_decimals, _update_product_from_pricing, calculate
from app.schemas.pricing import PricingInput


def pricing_payload(product_id):
    return {
        "product_id": product_id,
        "acquisition_price": 30,
        "lote": 1,
        "avarias_pct": 0,
        "frete_pct": 0,
        "recursos_humanos_pct": 0,
        "margem_alvo": 0.2,
        "impostos_pct": 0.1,
    }


def test_calculate_distributes_acquisition_cost_and_margin():
    result = calculate(
        PricingInput(
            acquisition_price=100,
            lote=2,
            avarias_pct=0.1,
            frete_pct=0.05,
            recursos_humanos_pct=0,
            margem_alvo=0.2,
            impostos_pct=0.1,
        )
    )

    assert result.custo_unitario == 50
    assert result.total_deducoes_pct == 0.15
    assert result.custos_variaveis == 7.5
    assert result.total_custos == 57.5
    assert result.preco_venda == 82.142857
    assert result.margem_pct == 0.2
    assert result.markup_multiplicador == 1.6429


def test_calculate_rejects_margin_and_tax_that_consume_revenue():
    with pytest.raises(HTTPException, match="menor que 100%"):
        calculate(PricingInput(acquisition_price=10, margem_alvo=0.9, impostos_pct=0.1))


def test_calculate_with_zero_acquisition_keeps_zero_markup():
    result = calculate(PricingInput(acquisition_price=0))

    assert result.preco_venda == 0
    assert result.margem_pct == 0
    assert result.markup_multiplicador == 0


@pytest.mark.parametrize(
    ("abbreviation", "expected"),
    [("kg", 3), ("KG", 3), ("un", 2), (None, 2)],
)
def test_unit_decimals_follow_weight_precision(abbreviation, expected):
    unit = SimpleNamespace(abbreviation=abbreviation) if abbreviation else None
    product = SimpleNamespace(unit=unit)

    assert _unit_decimals(product) == expected


def test_update_product_from_pricing_preserves_weight_precision():
    product = SimpleNamespace(unit=SimpleNamespace(abbreviation="kg"))
    result = calculate(PricingInput(acquisition_price=10, lote=3))

    _update_product_from_pricing(product, result)

    assert product.cost_price == round(result.custo_unitario, 3)
    assert product.markup == round(result.markup_multiplicador, 4)
    assert product.price == round(result.preco_venda, 3)


def test_save_pricing_creates_then_updates_product_values(
    client, auth_headers, db, seed_products
):
    payload = pricing_payload(seed_products[0].id)
    response = client.post("/api/pricing/", json=payload, headers=auth_headers)

    assert response.status_code == 201
    assert response.json()["product_id"] == seed_products[0].id
    assert db.query(ProductPricing).count() == 1
    first_price = response.json()["price"]

    payload["acquisition_price"] = 40
    response = client.post("/api/pricing/", json=payload, headers=auth_headers)

    assert response.status_code == 201
    assert response.json()["price"] > first_price
    assert db.query(ProductPricing).count() == 1


def test_pricing_routes_return_not_found_for_unknown_product(client, auth_headers):
    response = client.get("/api/pricing/999", headers=auth_headers)
    assert response.status_code == 404

    response = client.delete("/api/pricing/999", headers=auth_headers)
    assert response.status_code == 404


def test_apply_price_persists_product_price(client, auth_headers, db, seed_products):
    product = seed_products[0]
    response = client.post(
        f"/api/pricing/{product.id}/apply",
        json=pricing_payload(product.id),
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["product"]["id"] == product.id
    db.refresh(product)
    assert product.price == response.json()["product"]["price"]
