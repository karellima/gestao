import logging
import os
import time
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.database import engine
from app.logging_config import setup_logging
from app.routers import (
    accounts,
    auth,
    categories,
    contact_segments,
    contacts,
    deposits,
    financial,
    financial_categories,
    payment_types,
    payments,
    price_tables,
    pricing,
    products,
    recurrence_frequencies,
    reports,
    requisicoes,
    roles,
    settings,
    stock,
    units,
)
from app.routers.sales import sale_router, sale_type_router

setup_logging()
logger = logging.getLogger("gestao.main")

# O boot não aplica DDL. Nenhuma.
#
# Este arquivo já criou o schema inteiro no import, a partir dos models, e ainda
# corrigia colunas com dois blocos de ALTER — um para SQLite, outro para
# Postgres — que rodavam a cada deploy e a cada worker do uvicorn. O schema
# passava a ser o que os models dissessem no instante da subida: nada revisável,
# nada reproduzível, nada reversível.
#
# Agora o schema muda só por migration, e só quando alguém manda:
#     cd backend && alembic upgrade head
#
# O deploy roda isso antes de subir o app (ver `ops/entrypoint.sh`).
# Banco que já existia entra na cadeia com `alembic stamp 3f9bdb34aa4d` — ver
# `backend/docs/migrations.md`.

from app.startup import verificar_schema

verificar_schema(engine)

# O boot NÃO mexe em movimentações de estoque.
#
# Até aqui, toda subida do processo apagava as saídas de requisições ainda não
# recebidas e recalculava o saldo de todos os produtos. Isso reescrevia
# histórico sem registro de quem/quando, repetia a cada deploy e a cada worker
# do uvicorn, e transformava um conserto pontual de dados legados em rotina
# permanente. Movimentação gravada é fato: só se corrige por compensação.
#
# O conserto virou comando sob demanda, com dry-run e log:
#     python -m app.cli.repair_stock            # simula e mostra o relatório
#     python -m app.cli.repair_stock --apply    # aplica
#     POST /api/stock/repair                    # mesmo reparo, restrito a admin
from sqlalchemy.orm import Session

# Garante que o perfil operador tenha acesso aos relatórios de estoque e à busca de produtos
from app.models.role import Role, RoleModule

with Session(engine) as session:
    role = session.query(Role).filter(Role.name == "operador").first()
    if role:
        changed = False
        for module, level in (("stock_reports", "view"), ("products", "edit")):
            exists = session.query(RoleModule).filter(
                RoleModule.role_id == role.id,
                RoleModule.module == module,
            ).first()
            if not exists:
                session.add(RoleModule(role_id=role.id, module=module, access_level=level))
                changed = True
        if changed:
            session.commit()

# Garante acesso às tabelas de preços: perfis com vendas recebem edição, perfis com contatos recebem leitura
with Session(engine) as session:
    for role in session.query(Role).all():
        if role.is_admin:
            continue
        has_sales = session.query(RoleModule).filter(
            RoleModule.role_id == role.id,
            RoleModule.module == "sales",
        ).first()
        has_contacts = session.query(RoleModule).filter(
            RoleModule.role_id == role.id,
            RoleModule.module == "contacts",
        ).first()
        if not has_sales and not has_contacts:
            continue
        exists = session.query(RoleModule).filter(
            RoleModule.role_id == role.id,
            RoleModule.module == "price_tables",
        ).first()
        if not exists:
            session.add(RoleModule(
                role_id=role.id,
                module="price_tables",
                access_level="edit" if has_sales else "view",
            ))
            session.commit()

from seed import seed, seed_frequencies

seed()
seed_frequencies()

# Garante os seguimentos padrão de contatos (criados só se a tabela estiver vazia)
from app.models.contact_segment import ContactSegment

DEFAULT_SEGMENTS = [
    "Restaurante", "Supermercado", "Mercado", "Mercearia", "Padaria", "Confeitaria",
    "Pizzaria", "Lanchonete", "Sorveteria", "Açaí", "Adega", "Farmácia", "Perfumaria",
    "Distribuidora", "Academia", "Pet Shop", "Outro",
]
with Session(engine) as session:
    if session.query(ContactSegment).count() == 0:
        session.add_all([ContactSegment(name=name) for name in DEFAULT_SEGMENTS])
        session.commit()

app = FastAPI(title="Sistema de Gestão", version="1.0.0")

from app.config import CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS configurado com origens: %s", CORS_ORIGINS)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Erro não tratado em %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor"},
    )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    logger.info("%s %s %d %.0fms", request.method, request.url.path, response.status_code, duration_ms)
    return response

app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(stock.router)
app.include_router(financial_categories.router)
app.include_router(financial.router)
app.include_router(contacts.router)
app.include_router(deposits.router)
app.include_router(accounts.router)
app.include_router(payment_types.router)
app.include_router(units.router)
app.include_router(reports.router)
app.include_router(recurrence_frequencies.router)
app.include_router(payments.router)
app.include_router(sale_type_router)
app.include_router(sale_router)
app.include_router(requisicoes.router)
app.include_router(roles.router)
app.include_router(pricing.router)
app.include_router(price_tables.router)
app.include_router(contact_segments.router)
app.include_router(settings.router)

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")


def montar_frontend(app, diretorio=FRONTEND_DIR):
    """Serve o SPA buildado. Sem build, a raiz responde só a mensagem da API.

    Este `if` já morou solto aqui no fim do módulo, e o ramo executado dependia
    de `frontend/dist/` existir na máquina. Isso vazava para a cobertura do
    backend: quem tinha rodado `npm run build` media um número, quem não tinha
    media outro — e o quality gate reprovava conforme o estado do disco, não
    conforme o código. Como função com o diretório injetável, os dois caminhos
    são exercitados por teste em qualquer máquina.

    Devolve `True` se montou o SPA.
    """
    if os.path.isdir(diretorio):
        app.mount("/", StaticFiles(directory=diretorio, html=True), name="frontend")
        return True

    @app.get("/")
    def root():
        return {"message": "API do Sistema de Gestão - Estoque, Vendas e Financeiro"}

    return False


montar_frontend(app)
