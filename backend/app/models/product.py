from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent = relationship("Category", remote_side=[id], back_populates="subcategories")
    subcategories = relationship("Category", back_populates="parent")
    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    sku = Column(String(100), unique=True, index=True)
    barcode = Column(String(100))
    price = Column(Float, nullable=True)
    cost_price = Column(Float, nullable=True)
    markup = Column(Float, nullable=True)
    current_stock = Column(Float, default=0)
    min_stock = Column(Float, default=0)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    deposit_id = Column(Integer, ForeignKey("deposits.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    category = relationship("Category", back_populates="products")
    deposit = relationship("Deposit", back_populates="products")
    unit = relationship("Unit")
    stock_movements = relationship("StockMovement", back_populates="product")

    @property
    def display_name(self):
        if self.unit and self.unit.abbreviation:
            return f"{self.name} {self.unit.abbreviation}"
        return self.name
