from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ProductPricing(Base):
    __tablename__ = "product_pricings"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, unique=True)
    acquisition_price = Column(Float, nullable=False, default=0)
    lote = Column(Float, nullable=False, default=1)
    avarias_pct = Column(Float, nullable=False, default=0.06)
    comissao_pct = Column(Float, nullable=False, default=0)
    frete_pct = Column(Float, nullable=False, default=0.05)
    outros_custos_pct = Column(Float, nullable=False, default=0)
    recursos_humanos_pct = Column(Float, nullable=False, default=0.05)
    taxa_cartao_pct = Column(Float, nullable=False, default=0)
    taxas_antecipacao_pct = Column(Float, nullable=False, default=0)
    margem_alvo = Column(Float, nullable=False, default=0.20)
    impostos_pct = Column(Float, nullable=False, default=0.06)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    product = relationship("Product")
