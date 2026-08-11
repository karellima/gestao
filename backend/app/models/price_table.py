from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class PriceTable(Base):
    __tablename__ = "price_tables"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    items = relationship("PriceTableItem", back_populates="price_table", cascade="all, delete-orphan")


class PriceTableItem(Base):
    __tablename__ = "price_table_items"

    id = Column(Integer, primary_key=True, index=True)
    price_table_id = Column(Integer, ForeignKey("price_tables.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    price = Column(Float, nullable=False)

    price_table = relationship("PriceTable", back_populates="items")
    product = relationship("Product")
