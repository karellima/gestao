from sqlalchemy import Boolean, Column, Integer, String

from app.database import Base


class ContactSegment(Base):
    __tablename__ = "contact_segments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
