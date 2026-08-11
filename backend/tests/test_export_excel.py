"""POST /api/reports/export-excel — o que o cliente manda não vira header nem crash.

O endpoint recebe título, nome de arquivo e linhas livres vindas do navegador e
devolve um .xlsx. Três coisas do payload chegavam cruas onde não podiam:
o nome no ``Content-Disposition``, o título na aba da planilha e valores
aninhados nas células.
"""


def _payload(**overrides):
    base = {
        "title": "Relatório",
        "columns": [{"header": "Produto", "width": 20}],
        "rows": [{"Produto": "Café"}],
        "filename": "relatorio",
    }
    base.update(overrides)
    return base


def test_nome_de_arquivo_nao_escapa_do_header(client):
    """Aspa no filename fecharia o campo e deixaria o cliente reescrever o header."""
    resposta = client.post(
        "/api/reports/export-excel",
        json=_payload(filename='ok"; filename="malicioso.html'),
    )

    assert resposta.status_code == 200
    disposition = resposta.headers["content-disposition"]
    # Aspa, ponto-e-vírgula e igual saem fora; sobra um nome só.
    assert disposition == 'attachment; filename="ok filenamemalicioso.html.xlsx"'
    assert disposition.count('filename="') == 1


def test_quebra_de_linha_no_nome_nao_injeta_header(client):
    resposta = client.post(
        "/api/reports/export-excel",
        json=_payload(filename="linha1\r\nX-Injetado: sim"),
    )

    assert resposta.status_code == 200
    assert "\n" not in resposta.headers["content-disposition"]
    assert "x-injetado" not in {k.lower() for k in resposta.headers}


def test_titulo_com_barra_nao_derruba_a_planilha(client):
    """`/` é proibido em nome de aba: sem tratamento, o openpyxl estoura em 500."""
    resposta = client.post(
        "/api/reports/export-excel",
        json=_payload(title="Vendas 01/2026"),
    )

    assert resposta.status_code == 200


def test_valor_aninhado_nao_derruba_a_planilha(client):
    """`rows` é JSON livre; lista ou objeto na célula estourava ValueError."""
    resposta = client.post(
        "/api/reports/export-excel",
        json=_payload(rows=[{"Produto": ["Café", "Chá"]}]),
    )

    assert resposta.status_code == 200


def test_nome_vazio_apos_limpeza_tem_fallback(client):
    resposta = client.post(
        "/api/reports/export-excel",
        json=_payload(filename="///", title="///"),
    )

    assert resposta.status_code == 200
    assert resposta.headers["content-disposition"] == 'attachment; filename="relatorio.xlsx"'


def test_exportacao_exige_autenticacao(db):
    """Sem `get_current_user` resolvido, o endpoint não responde 200."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.database import get_db
    from app.routers import reports as reports_router

    api = FastAPI()
    api.include_router(reports_router.router)
    api.dependency_overrides[get_db] = lambda: db
    with TestClient(api) as anonimo:
        resposta = anonimo.post("/api/reports/export-excel", json=_payload())

    assert resposta.status_code == 401
