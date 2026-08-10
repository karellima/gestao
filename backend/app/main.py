from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base
from app.routers import auth, products, stock, financial, contacts, reports, payments
from app.routers import categories, financial_categories, deposits, accounts, payment_types, units, recurrence_frequencies
from app.routers import requisicoes, roles, pricing
from app.routers import price_tables
from app.routers import contact_segments
from app.routers import settings
from app.routers.sales import sale_type_router, sale_router

import logging
import time
import os
from datetime import datetime

from app.logging_config import setup_logging
setup_logging()

logger = logging.getLogger("gestao.main")

from app.config import DATABASE_URL, CORS_ORIGINS

Base.metadata.create_all(bind=engine)

from app.config import DATABASE_URL

# Migrações SQLite (só executa se for SQLite)
if DATABASE_URL.startswith("sqlite"):
    import sqlite3
    db_path = DATABASE_URL.replace("sqlite:///", "")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("PRAGMA table_info(stock_movements)")
        cols = [row[1] for row in c.fetchall()]
        if "movement_date" not in cols:
            c.execute("ALTER TABLE stock_movements ADD COLUMN movement_date DATETIME DEFAULT CURRENT_TIMESTAMP")
            conn.commit()
        c.execute("PRAGMA table_info(products)")
        product_cols = {row[1]: row for row in c.fetchall()}
        if product_cols.get("name") and product_cols["name"][3]:
            c.execute("CREATE TABLE IF NOT EXISTS products_new (id INTEGER PRIMARY KEY, name TEXT, description TEXT, sku TEXT UNIQUE, barcode TEXT, price REAL, cost_price REAL, markup REAL, current_stock INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 0, unit_id INTEGER REFERENCES units(id), category_id INTEGER REFERENCES categories(id), deposit_id INTEGER REFERENCES deposits(id), is_active BOOLEAN DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME)")
            c.execute("INSERT INTO products_new SELECT * FROM products")
            c.execute("DROP TABLE products")
            c.execute("ALTER TABLE products_new RENAME TO products")
            c.execute("CREATE INDEX IF NOT EXISTS ix_products_sku ON products(sku)")
            conn.commit()
        c.execute("PRAGMA table_info(products)")
        prod_cols2 = [row[1] for row in c.fetchall()]
        if "markup" not in prod_cols2:
            c.execute("ALTER TABLE products ADD COLUMN markup REAL")
        conn.commit()
        c.execute("PRAGMA table_info(accounts)")
        acc_cols = [row[1] for row in c.fetchall()]
        for col, typedef in [("flag", "TEXT"), ("closing_day", "INTEGER"), ("due_day", "INTEGER"), ("best_purchase_day", "INTEGER"), ("credit_limit", "REAL")]:
            if col not in acc_cols:
                c.execute("ALTER TABLE accounts ADD COLUMN " + col + " " + typedef)
        conn.commit()
        c.execute("PRAGMA table_info(contacts)")
        ct_cols = [row[1] for row in c.fetchall()]
        if "price_table_id" not in ct_cols:
            c.execute("ALTER TABLE contacts ADD COLUMN price_table_id INTEGER")
        if "segment" not in ct_cols:
            c.execute("ALTER TABLE contacts ADD COLUMN segment TEXT")
        if "cep" not in ct_cols:
            c.execute("ALTER TABLE contacts ADD COLUMN cep TEXT")
        conn.commit()
        c.execute("PRAGMA table_info(transactions)")
        tx_cols = [row[1] for row in c.fetchall()]
        if "recurrence_frequency" not in tx_cols:
            c.execute("ALTER TABLE transactions ADD COLUMN recurrence_frequency TEXT")
            if "is_recurring" in tx_cols:
                c.execute("UPDATE transactions SET recurrence_frequency = 'mensal' WHERE is_recurring = 1")
        if "due_date" not in tx_cols:
            c.execute("ALTER TABLE transactions ADD COLUMN due_date DATETIME")
        if "status" not in tx_cols:
            c.execute("ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'pendente'")
        c.execute("PRAGMA table_info(requisicao_items)")
        ri_cols = [row[1] for row in c.fetchall()]
        if "quantity_fulfilled" not in ri_cols:
            c.execute("ALTER TABLE requisicao_items ADD COLUMN quantity_fulfilled INTEGER DEFAULT 0")
        if "quantity_received" not in ri_cols:
            c.execute("ALTER TABLE requisicao_items ADD COLUMN quantity_received INTEGER DEFAULT 0")
        c.execute("PRAGMA table_info(stock_movements)")
        sm_cols = [row[1] for row in c.fetchall()]
        if "source" not in sm_cols:
            c.execute("ALTER TABLE stock_movements ADD COLUMN source VARCHAR(20)")
            c.execute("UPDATE stock_movements SET source='requisicao' WHERE reason LIKE 'Requisi\u00e7\u00e3o #%' OR reason LIKE 'Recebimento Requisi\u00e7\u00e3o #%'")
        conn.commit()
        conn.close()

# Migrações PostgreSQL
if not DATABASE_URL.startswith("sqlite"):
    from sqlalchemy import text
    with engine.connect() as conn:
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'requisicao_items'"
        )).fetchall()
        ri_names = {row[0] for row in cols}
        if "quantity_fulfilled" not in ri_names:
            conn.execute(text(
                "ALTER TABLE requisicao_items ADD COLUMN quantity_fulfilled INTEGER DEFAULT 0"
            ))
        if "quantity_received" not in ri_names:
            conn.execute(text(
                "ALTER TABLE requisicao_items ADD COLUMN quantity_received INTEGER DEFAULT 0"
            ))
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_movements'"
        )).fetchall()
        if "source" not in {row[0] for row in cols}:
            conn.execute(text(
                "ALTER TABLE stock_movements ADD COLUMN source VARCHAR(20)"
            ))
            conn.execute(text(
                "UPDATE stock_movements SET source='requisicao' WHERE reason LIKE 'Requisi\u00e7\u00e3o #%' OR reason LIKE 'Recebimento Requisi\u00e7\u00e3o #%'"
            ))
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'products'"
        )).fetchall()
        if "markup" not in {row[0] for row in cols}:
            conn.execute(text(
                "ALTER TABLE products ADD COLUMN markup DOUBLE PRECISION"
            ))
        for table, columns in {
            "stock_movements": ["quantity"],
            "requisicao_items": ["quantity_requested", "quantity_approved", "quantity_fulfilled", "quantity_received"],
            "products": ["current_stock", "min_stock"],
        }.items():
            existing = {row[0] for row in conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = :t"
            ).bindparams(t=table)).fetchall()}
            for col in columns:
                if col not in existing:
                    continue
                dtype = conn.execute(text(
                    "SELECT data_type FROM information_schema.columns WHERE table_name = :t AND column_name = :c"
                ).bindparams(t=table, c=col)).fetchone()[0]
                if dtype in ("integer", "smallint", "bigint"):
                    conn.execute(text(
                        f"ALTER TABLE {table} ALTER COLUMN {col} TYPE DOUBLE PRECISION"
                    ))
        cols = conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'"
        )).fetchall()
        if "price_table_id" not in {row[0] for row in cols}:
            conn.execute(text(
                "ALTER TABLE contacts ADD COLUMN price_table_id INTEGER REFERENCES price_tables(id)"
            ))
        conn.commit()
        cols2 = conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'"
        )).fetchall()
        ct_names = {row[0] for row in cols2}
        if "segment" not in ct_names:
            conn.execute(text("ALTER TABLE contacts ADD COLUMN segment VARCHAR(50)"))
        if "cep" not in ct_names:
            conn.execute(text("ALTER TABLE contacts ADD COLUMN cep VARCHAR(10)"))
        conn.commit()

# Migração: movimentações de requisição só são gravadas após o recebimento.
# Remove saídas de requisições ainda não recebidas (em trânsito).
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.stock import StockMovement
from app.models.requisicao import Requisicao
from app.models.product import Product

with Session(engine) as session:
    pending = [r[0] for r in session.query(Requisicao.id).filter(Requisicao.status != "recebido").all()]
    affected = set()
    for rid in pending:
        movs = session.query(StockMovement).filter(
            StockMovement.movement_type == "saida",
            StockMovement.source == "requisicao",
            StockMovement.reason.like(f"Requisição #{rid}:%"),
        ).all()
        for m in movs:
            affected.add(m.product_id)
            session.delete(m)
    if affected:
        session.flush()
        for pid in affected:
            entrada = session.query(func.coalesce(func.sum(StockMovement.quantity), 0)).filter(
                StockMovement.product_id == pid, StockMovement.movement_type == "entrada"
            ).scalar()
            saida = session.query(func.coalesce(func.sum(StockMovement.quantity), 0)).filter(
                StockMovement.product_id == pid, StockMovement.movement_type == "saida"
            ).scalar()
            product = session.query(Product).filter(Product.id == pid).first()
            if product:
                product.current_stock = entrada - saida
    # Recalcula o estoque global de todos os produtos a partir das movimentações
    for product in session.query(Product).all():
        entrada = session.query(func.coalesce(func.sum(StockMovement.quantity), 0)).filter(
            StockMovement.product_id == product.id, StockMovement.movement_type == "entrada"
        ).scalar()
        saida = session.query(func.coalesce(func.sum(StockMovement.quantity), 0)).filter(
            StockMovement.product_id == product.id, StockMovement.movement_type == "saida"
        ).scalar()
        product.current_stock = entrada - saida
    session.commit()

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"CORS configurado com origens: {CORS_ORIGINS}")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Erro não tratado em {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor"},
    )

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    logger.info(
        "%s %s %d %.0fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
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
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {"message": "API do Sistema de Gestão - Estoque, Vendas e Financeiro"}
