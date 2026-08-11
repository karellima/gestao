from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class SaleType(Base):
    __tablename__ = "sale_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    sale_type_id = Column(Integer, ForeignKey("sale_types.id"), nullable=False)
    total_amount = Column(Float, default=0)
    status = Column(String(20), default="aberto")
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    user_id = Column(Integer, ForeignKey("users.id"))

    contact = relationship("Contact")
    sale_type = relationship("SaleType")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, default=1)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")
