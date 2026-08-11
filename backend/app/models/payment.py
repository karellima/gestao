from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    amount = Column(Float, nullable=False)
    interest = Column(Float, default=0)
    payment_date = Column(DateTime(timezone=True), nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("Transaction", back_populates="payments")
