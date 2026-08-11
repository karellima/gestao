import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("gestao.config")

_db_url = os.getenv("DATABASE_URL", "sqlite:///./gestao.db")
if _db_url.startswith("sqlite:///./"):
    _db_url = "sqlite:///" + os.path.abspath(os.path.join(os.path.dirname(__file__), "..", _db_url.replace("sqlite:///./", "")))

DATABASE_URL = _db_url
DEFAULT_SECRET = "your-secret-key-change-in-production"
SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_SECRET)
if SECRET_KEY == DEFAULT_SECRET:
    if not _db_url.startswith("sqlite"):
        raise RuntimeError(
            "SECRET_KEY não configurada. Defina SECRET_KEY no ambiente (ex.: python -c \"import secrets; print(secrets.token_hex(32))\")"
        )
    logger.warning("SECRET_KEY usando valor padrão inseguro. Configure SECRET_KEY no ambiente para produção.")

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

# O default cobre só o desenvolvimento local. Produção enumera o próprio domínio
# em CORS_ORIGINS — ver `.env.ionos.example`. Um default apontando para o host de
# produção envelhece calado: continua parecendo certo depois que o endereço muda,
# e o erro só aparece no navegador de quem usa o sistema.
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", ",".join([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]))
CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS_RAW.split(",") if o.strip()]

# O CORS sobe com `allow_credentials=True`. Um `*` na lista faria o Starlette
# refletir a origem de qualquer site e ainda liberar credenciais — o buraco
# clássico. Origem tem de ser enumerada; curinga não é configuração, é engano.
if "*" in CORS_ORIGINS:
    raise RuntimeError(
        "CORS_ORIGINS não aceita '*': liste as origens explicitamente "
        "(ex.: CORS_ORIGINS=https://seu-dominio.com,http://localhost:5173)."
    )

# O administrador inicial vem só do ambiente, em `seed.py`. Não há credencial
# padrão: banco sem ADMIN_EMAIL/ADMIN_PASSWORD nasce sem usuário nenhum, que é
# o que README e AGENTS.md prometem.

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = os.getenv("LOG_FORMAT", "text")

_warnings_env = os.getenv("PYTHONWARNINGS", "")
if not _warnings_env:
    if not _db_url.startswith("sqlite"):
        os.environ.setdefault("PYTHONWARNINGS", "ignore")
