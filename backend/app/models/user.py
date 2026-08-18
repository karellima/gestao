from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

user_deposits = Table(
    "user_deposits",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("deposit_id", Integer, ForeignKey("deposits.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="user")
    is_active = Column(Boolean, default=True)
    #: Geração da credencial. Sobe em 1 a cada troca de senha ou desativação, e
    #: o JWT carrega o valor que valia quando foi emitido. Token com versão
    #: antiga para de ser aceito — é o que transforma "trocar a senha" em
    #: "derrubar as sessões", que antes não acontecia: quem tivesse o token
    #: continuava dentro por até 8 horas depois da troca.
    token_version = Column(Integer, nullable=False, server_default="1")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    deposits = relationship("Deposit", secondary=user_deposits, back_populates="users")
