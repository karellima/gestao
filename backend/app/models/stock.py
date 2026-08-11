from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    deposit_id = Column(Integer, ForeignKey("deposits.id"), nullable=False)
    movement_type = Column(String(20), nullable=False)
    movement_date = Column(DateTime, nullable=False, server_default=func.now())
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, default=0)
    total_value = Column(Float, default=0)
    reason = Column(String(255))
    notes = Column(Text)
    source = Column(String(20))
    # Movimentação que esta estorna. O histórico é imutável: corrigir um
    # lançamento significa gravar o inverso apontando para o original, nunca
    # editar ou apagar a linha errada.
    compensates_movement_id = Column(Integer, ForeignKey("stock_movements.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"))

    product = relationship("Product", back_populates="stock_movements")
    deposit = relationship("Deposit")
    compensates = relationship("StockMovement", remote_side=[id], uselist=False)

    @property
    def product_name(self):
        return self.product.name if self.product else None

    @property
    def deposit_name(self):
        return self.deposit.name if self.deposit else None
