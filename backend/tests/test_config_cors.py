"""CORS: a lista de origens é enumerada, nunca curinga.

O app sobe o CORSMiddleware com ``allow_credentials=True``. Se `*` entrasse na
lista, o Starlette passaria a refletir a origem de quem pedir e ainda mandaria
``Access-Control-Allow-Credentials: true`` — qualquer site na internet falando
com a API em nome do usuário logado. `config.py` recusa isso na subida.
"""

import importlib

import pytest

import app.config


def _recarrega():
    return importlib.reload(app.config)


@pytest.fixture(autouse=True)
def restaura_config():
    """Devolve `app.config` ao estado do ambiente de teste ao fim de cada caso."""
    yield
    _recarrega()


def test_curinga_sozinho_e_recusado(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "*")

    with pytest.raises(RuntimeError, match=r"CORS_ORIGINS não aceita '\*'"):
        _recarrega()


def test_curinga_escondido_numa_lista_tambem_e_recusado(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://gestao-iscb.onrender.com, *")

    with pytest.raises(RuntimeError, match=r"CORS_ORIGINS não aceita '\*'"):
        _recarrega()


def test_lista_explicita_passa(monkeypatch):
    monkeypatch.setenv(
        "CORS_ORIGINS", "https://gestao-iscb.onrender.com, http://localhost:5173"
    )

    config = _recarrega()

    assert config.CORS_ORIGINS == [
        "https://gestao-iscb.onrender.com",
        "http://localhost:5173",
    ]


def test_sem_variavel_usa_as_origens_padrao(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    config = _recarrega()

    assert "https://gestao-iscb.onrender.com" in config.CORS_ORIGINS
    assert "*" not in config.CORS_ORIGINS


def test_nao_ha_credencial_de_admin_padrao(monkeypatch):
    """O admin inicial vem só do ambiente; `config` não guarda mais um fallback."""
    config = _recarrega()

    assert not hasattr(config, "ADMIN_PASSWORD")
    assert not hasattr(config, "ADMIN_EMAIL")
