from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Requisicao(Base):
    __tablename__ = "requisicoes"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"))
    deposit_requesting_id = Column(Integer, ForeignKey("deposits.id"), nullable=False)
    deposit_fulfilling_id = Column(Integer, ForeignKey("deposits.id"), nullable=False)
    status = Column(String(20), default="pendente")
    reason = Column(String(255))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    requester = relationship("User", foreign_keys=[requester_id])
    approver = relationship("User", foreign_keys=[approver_id])
    deposit_requesting = relationship("Deposit", foreign_keys=[deposit_requesting_id])
    deposit_fulfilling = relationship("Deposit", foreign_keys=[deposit_fulfilling_id])
    items = relationship("RequisicaoItem", back_populates="requisicao", cascade="all, delete-orphan")


class RequisicaoItem(Base):
    __tablename__ = "requisicao_items"

    id = Column(Integer, primary_key=True, index=True)
    requisicao_id = Column(Integer, ForeignKey("requisicoes.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity_requested = Column(Float, nullable=False)
    quantity_approved = Column(Float)
    quantity_fulfilled = Column(Float, default=0)
    quantity_received = Column(Float, default=0)
    unit_price = Column(Float)

    requisicao = relationship("Requisicao", back_populates="items")
    product = relationship("Product")
