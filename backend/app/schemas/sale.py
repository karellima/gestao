from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SaleTypeCreate(BaseModel):
    name: str
    description: str | None = None


class SaleTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class SaleTypeResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    is_active: bool
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)
    unit_price: float = Field(gt=0)


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: float
    unit_price: float
    total_price: float
    product_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SaleCreate(BaseModel):
    contact_id: int
    sale_type_id: int
    notes: str | None = None
    items: list[SaleItemCreate]


class SaleUpdate(BaseModel):
    contact_id: int | None = None
    sale_type_id: int | None = None
    status: str | None = None
    notes: str | None = None
    items: list[SaleItemCreate] | None = None


class SaleResponse(BaseModel):
    id: int
    contact_id: int
    sale_type_id: int
    total_amount: float
    status: str
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    contact_name: str | None = None
    sale_type_name: str | None = None
    items: list[SaleItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
