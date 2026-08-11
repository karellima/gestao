import io

import openpyxl
import pytest

from app.models.product import Product
from app.routers.products import cleanup


def _workbook_bytes(rows):
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(["Nome", "SKU", "Descrição", "Código de Barras", "Preço Venda"])
    for row in rows:
        sheet.append(row)
    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_import_excel_rejeita_arquivo_invalido_com_erro_do_cliente(client):
    response = client.post(
        "/api/products/import-excel",
        files={
            "file": (
                "produtos.xlsx",
                b"nao e um xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Arquivo Excel inválido"


def test_cleanup_nao_engole_interrupcao(monkeypatch):
    def interromper(_path):
        raise KeyboardInterrupt

    monkeypatch.setattr("app.routers.products.os.unlink", interromper)

    with pytest.raises(KeyboardInterrupt):
        cleanup("arquivo-temporario.xlsx")


def test_import_excel_preserva_importacao_parcial_e_erros_por_linha(
    client, db, seed_units, seed_categories
):
    response = client.post(
        "/api/products/import-excel",
        files={
            "file": (
                "produtos.xlsx",
                _workbook_bytes(
                    [
                        ["Produto Importado", "IMP-001", "", "", 12.5],
                        ["Produto sem SKU", "", "", "", 10],
                    ]
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "imported": 1,
        "errors": ["Linha 3: Nome e SKU são obrigatórios"],
    }
    assert db.query(Product).filter(Product.sku == "IMP-001").one().name == "Produto Importado"


def test_import_excel_reporta_unidade_inexistente_sem_criar_produto(
    client, db, seed_categories
):
    response = client.post(
        "/api/products/import-excel",
        files={
            "file": (
                "produtos.xlsx",
                _workbook_bytes([["Produto", "IMP-002", "", "", 10, "", "", "Caixa"]]),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "imported": 0,
        "errors": ["Linha 2: Unidade 'Caixa' não encontrada"],
    }
    assert db.query(Product).filter(Product.sku == "IMP-002").first() is None


def test_import_excel_atualiza_sku_existente_sem_apagar_valores_ausentes(
    client, db, seed_categories
):
    product = Product(name="Nome antigo", sku="IMP-003", price=25, description="Mantém")
    db.add(product)
    db.commit()

    response = client.post(
        "/api/products/import-excel",
        files={
            "file": (
                "produtos.xlsx",
                _workbook_bytes([["Nome novo", "IMP-003", "", "", 30]]),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200
    assert response.json() == {"imported": 1, "errors": []}
    db.refresh(product)
    assert product.name == "Nome novo"
    assert product.price == 30
    assert product.description == "Mantém"


def test_import_excel_preserva_custo_e_estoque_quando_colunas_existirem(
    client, db, seed_categories
):
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append([
        "Nome", "SKU", "Descrição", "Código de Barras", "Preço Venda",
        "Preço Custo", "Categoria", "Subcategoria", "Unidade", "Estoque Atual", "Estoque Mínimo",
    ])
    sheet.append(["Produto completo", "IMP-004", "", "", 30, 18, "", "", "", 9, 2])
    output = io.BytesIO()
    workbook.save(output)

    response = client.post(
        "/api/products/import-excel",
        files={
            "file": (
                "produtos.xlsx",
                output.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200
    product = db.query(Product).filter(Product.sku == "IMP-004").one()
    assert product.cost_price == 18
    assert product.current_stock == 9
    assert product.min_stock == 2
