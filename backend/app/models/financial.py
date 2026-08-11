from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False)  # "receita" ou "despesa"
    financial_category_id = Column(Integer, ForeignKey("financial_categories.id"), nullable=True)
    description = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)  # data de lançamento
    due_date = Column(DateTime(timezone=True))  # data de vencimento (1ª parcela)
    payment_type_id = Column(Integer, ForeignKey("payment_types.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"))
    installments = Column(Integer, default=1)
    current_installment = Column(Integer, default=1)  # parcela inicial (ex: entrada 1/12)
    recurrence_frequency = Column(String(20))  # "semanal", "quinzenal", "mensal"
    status = Column(String(20), default="pendente")  # "pendente", "pago_parcial", "pago", "recebido"
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"))

    financial_category = relationship("FinancialCategory")
    payment_type = relationship("PaymentType")
    account = relationship("Account")
    contact = relationship("Contact")
    payments = relationship("Payment", back_populates="transaction")
