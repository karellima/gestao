from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Deposit(Base):
    __tablename__ = "deposits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    address = Column(Text)
    parent_id = Column(Integer, ForeignKey("deposits.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent = relationship("Deposit", remote_side=[id], back_populates="children")
    children = relationship("Deposit", back_populates="parent")
    products = relationship("Product", back_populates="deposit")
    users = relationship("User", secondary="user_deposits", back_populates="deposits")
