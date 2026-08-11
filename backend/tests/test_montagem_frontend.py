"""A montagem do SPA não pode fazer a cobertura depender do build.

O fim do `app/main.py` escolhe entre servir `frontend/dist/` e expor só a
mensagem da raiz. Enquanto esse `if` rodava solto no import, o ramo medido era
o que o disco daquela máquina ditasse: com o frontend buildado a cobertura do
backend dava um número, sem ele dava outro. O quality gate então reprovava
dependendo de alguém ter rodado `npm run build` — e o CI, que não builda,
nunca via o mesmo número que a máquina de quem desenvolve.

Estes testes exercitam os dois caminhos com diretórios de mentira, então a
medição passa a ser a mesma em qualquer estado do repositório.

`app.main` é importado dentro de cada teste, e não no topo: o import verifica o
schema do banco, e na coleta os testes ainda não criaram as tabelas. É o mesmo
motivo pelo qual o `conftest` importa tarde.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_sem_build_a_raiz_responde_a_mensagem_da_api(db, tmp_path):
    from app.main import montar_frontend

    app = FastAPI()

    montou = montar_frontend(app, str(tmp_path / "dist-inexistente"))

    assert montou is False
    resposta = TestClient(app).get("/")
    assert resposta.status_code == 200
    assert "API do Sistema de Gestão" in resposta.json()["message"]


def test_com_build_a_raiz_serve_o_index(db, tmp_path):
    from app.main import montar_frontend

    app = FastAPI()
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html><title>gestao</title>")

    montou = montar_frontend(app, str(dist))

    assert montou is True
    resposta = TestClient(app).get("/")
    assert resposta.status_code == 200
    assert "gestao" in resposta.text


def test_o_padrao_aponta_para_o_dist_do_frontend(db):
    """Sem argumento, monta o build real — é assim que produção serve o SPA."""
    from app.main import FRONTEND_DIR

    assert FRONTEND_DIR.endswith("frontend/dist")
