from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class ContactCreate(BaseModel):
    name: str
    contact_type: str  # "cliente", "fornecedor" ou "both"
    cpf_cnpj: str | None = None
    segment: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    cep: str | None = None
    city: str | None = None
    state: str | None = None
    price_table_id: int | None = None
    notes: str | None = None


class ContactUpdate(BaseModel):
    name: str | None = None
    contact_type: str | None = None
    cpf_cnpj: str | None = None
    segment: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    cep: str | None = None
    city: str | None = None
    state: str | None = None
    price_table_id: int | None = None
    notes: str | None = None
    is_active: bool | None = None


class ContactResponse(BaseModel):
    id: int
    name: str
    contact_type: str
    cpf_cnpj: str | None = None
    segment: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    cep: str | None = None
    city: str | None = None
    state: str | None = None
    price_table_id: int | None = None
    notes: str | None = None
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True
