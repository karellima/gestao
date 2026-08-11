from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class FinancialCategory(Base):
    __tablename__ = "financial_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    type = Column(String(20), nullable=False)  # "receita" ou "despesa"
    parent_id = Column(Integer, ForeignKey("financial_categories.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent = relationship("FinancialCategory", remote_side=[id], back_populates="subcategories")
    subcategories = relationship("FinancialCategory", back_populates="parent")
