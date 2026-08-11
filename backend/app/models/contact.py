from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    contact_type = Column(String(20), nullable=False)  # "cliente", "fornecedor" ou "both"
    cpf_cnpj = Column(String(20))
    segment = Column(String(50))
    email = Column(String(255))
    phone = Column(String(20))
    address = Column(Text)
    cep = Column(String(10))
    city = Column(String(100))
    state = Column(String(2))
    price_table_id = Column(Integer, ForeignKey("price_tables.id"), nullable=True)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
