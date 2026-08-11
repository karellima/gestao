from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PaymentTypeCreate(BaseModel):
    name: str
    description: str | None = None
    requires_installments: bool | None = False


class PaymentTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    requires_installments: bool | None = None
    is_active: bool | None = None


class PaymentTypeResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    requires_installments: bool
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True
