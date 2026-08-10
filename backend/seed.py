"""
Script para popular dados iniciais em banco novo.
- Cria perfis (roles), categorias, unidades e depósitos de exemplo.
- Administrador só é criado se as variáveis ADMIN_EMAIL e ADMIN_PASSWORD
  estiverem definidas no ambiente. Sem elas, o banco nasce sem usuários.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, SessionLocal
from app.models.user import User
from app.models.product import Category
from app.models.unit import Unit
from app.models.deposit import Deposit
from app.models.recurrence_frequency import RecurrenceFrequency
from app.models.role import Role, RoleModule
from app.utils.security import get_password_hash

ALL_MODULES = ["dashboard", "contacts", "deposits", "deposits_manage", "products", "stock_reports", "requisicoes", "categories", "units", "stock_movements", "accounts", "financial", "financial_categories", "payment_types", "recurrence_frequencies", "financial_reports", "sale_types", "sales", "users", "roles", "precificacao", "price_tables", "settings"]


def _create_admin_user(db):
    admin_email = os.getenv("ADMIN_EMAIL", "").strip()
    admin_password = os.getenv("ADMIN_PASSWORD", "").strip()

    if not admin_email or not admin_password:
        print("ADMIN_EMAIL e ADMIN_PASSWORD nao definidos — pulando criacao do administrador.")
        return

    admin_name = os.getenv("ADMIN_NAME", "Administrador").strip()
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    if not admin_role:
        print("Perfil admin nao encontrado — pulando criacao do administrador.")
        return

    user = User(
        name=admin_name,
        email=admin_email,
        hashed_password=get_password_hash(admin_password),
        role="admin",
    )
    db.add(user)
    db.commit()
    print(f"Administrador criado: {admin_email}")


def seed():
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("Banco ja possui dados. Seed ignorado.")
            return

        print("Criando dados iniciais...")

        roles = [
            Role(name="admin", is_admin=True, is_default=False),
            Role(name="gerente", is_admin=False, is_default=False),
            Role(name="operador", is_admin=False, is_default=True),
            Role(name="visualizador", is_admin=False, is_default=False),
        ]
        db.add_all(roles)
        db.flush()

        gerente_modules = [m for m in ALL_MODULES if m not in ("users", "roles", "precificacao", "settings")]
        for m in gerente_modules:
            db.add(RoleModule(role_id=roles[1].id, module=m, access_level="edit"))

        operador_modules = ["contacts", "deposits", "products", "stock_movements", "stock_reports", "requisicoes", "categories", "units"]
        for m in operador_modules:
            db.add(RoleModule(role_id=roles[2].id, module=m, access_level="edit"))

        vis_modules = ["deposits", "products", "stock_movements"]
        for m in vis_modules:
            db.add(RoleModule(role_id=roles[3].id, module=m, access_level="view"))

        db.flush()

        _create_admin_user(db)

        cats = [
            Category(name="Bebidas"),
            Category(name="Alimentos"),
        ]
        db.add_all(cats)
        db.commit()

        cats[0].id
        subcats = [
            Category(name="Refrigerantes", parent_id=cats[0].id),
            Category(name="Sucos", parent_id=cats[0].id),
            Category(name="Cereais", parent_id=cats[1].id),
        ]
        db.add_all(subcats)
        db.commit()

        units = [
            Unit(name="Quilograma", abbreviation="kg"),
            Unit(name="Litro", abbreviation="L"),
            Unit(name="Unidade", abbreviation="un"),
            Unit(name="Metro", abbreviation="m"),
        ]
        db.add_all(units)
        db.commit()

        deps = [
            Deposit(name="Depósito Central", description="Depósito principal"),
            Deposit(name="Depósito Filial", description="Filial"),
        ]
        db.add_all(deps)
        db.commit()

        print("Dados iniciais criados!")
    finally:
        db.close()

def seed_frequencies():
    db = SessionLocal()
    try:
        if db.query(RecurrenceFrequency).count() > 0:
            return
        defaults = [
            RecurrenceFrequency(name="Semanal", days_interval=7),
            RecurrenceFrequency(name="Quinzenal", days_interval=15),
            RecurrenceFrequency(name="Mensal", days_interval=30),
            RecurrenceFrequency(name="Bimestral", days_interval=60),
            RecurrenceFrequency(name="Trimestral", days_interval=90),
            RecurrenceFrequency(name="Semestral", days_interval=180),
            RecurrenceFrequency(name="Anual", days_interval=365),
        ]
        db.add_all(defaults)
        db.commit()
        print("Frequências de recorrência criadas!")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
