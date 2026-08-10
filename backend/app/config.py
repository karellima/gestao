import os
import logging
import warnings
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

CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", ",".join([
    "https://gestao-iscb.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]))
CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS_RAW.split(",") if o.strip()]

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@admin.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = os.getenv("LOG_FORMAT", "text")

_warnings_env = os.getenv("PYTHONWARNINGS", "")
if not _warnings_env:
    if not _db_url.startswith("sqlite"):
        os.environ.setdefault("PYTHONWARNINGS", "ignore")
