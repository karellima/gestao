from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class Unit(Base):
    __tablename__ = "units"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    abbreviation = Column(String(10), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
