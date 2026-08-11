from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    account_type = Column(String(50), nullable=False)  # "banco", "caixa", "cartao_credito"
    bank_name = Column(String(255))
    agency = Column(String(20))
    account_number = Column(String(30))
    balance = Column(Float, default=0)
    flag = Column(String(50))  # Visa, Mastercard, Elo, Amex, etc.
    closing_day = Column(Integer)  # dia de fechamento da fatura
    due_day = Column(Integer)  # dia de vencimento da fatura
    best_purchase_day = Column(Integer)  # melhor dia para comprar
    credit_limit = Column(Float)  # limite do cartão
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
