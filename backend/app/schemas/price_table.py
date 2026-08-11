from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PriceTableItemCreate(BaseModel):
    product_id: int
    price: float = Field(gt=0)


class PriceTableCreate(BaseModel):
    name: str
    description: str | None = None
    items: list[PriceTableItemCreate] = []


class PriceTableUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    items: list[PriceTableItemCreate] | None = None


class PriceTableItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str | None = None
    price: float

    class Config:
        from_attributes = True


class PriceTableResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
    items: list[PriceTableItemResponse] = []

    class Config:
        from_attributes = True
