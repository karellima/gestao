from datetime import datetime

from pydantic import BaseModel, ConfigDict


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

    model_config = ConfigDict(from_attributes=True)
