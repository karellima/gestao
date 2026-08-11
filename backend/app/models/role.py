from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    is_admin = Column(Boolean, default=False)
    is_default = Column(Boolean, default=False)

    modules = relationship("RoleModule", back_populates="role", cascade="all, delete-orphan")


class RoleModule(Base):
    __tablename__ = "role_modules"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    module = Column(String(50), nullable=False)
    access_level = Column(String(10), default="edit")

    role = relationship("Role", back_populates="modules")
