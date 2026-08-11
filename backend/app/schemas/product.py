from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CategoryCreate(BaseModel):
    name: str
    description: str | None = None
    parent_id: int | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    parent_id: int | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    parent_id: int | None = None
    created_at: datetime | None = None
    subcategories: list["CategoryResponse"] = []

    model_config = ConfigDict(from_attributes=True)


class UnitResponse(BaseModel):
    id: int
    name: str
    abbreviation: str

    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    sku: str
    barcode: str | None = None
    price: float | None = None
    cost_price: float | None = None
    markup: float | None = None
    unit_id: int | None = None
    category_id: int | None = None
    deposit_id: int | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sku: str | None = None
    barcode: str | None = None
    price: float | None = None
    cost_price: float | None = None
    markup: float | None = None
    unit_id: int | None = None
    category_id: int | None = None
    deposit_id: int | None = None
    is_active: bool | None = None


class ProductResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    sku: str
    barcode: str | None = None
    price: float | None = None
    cost_price: float | None = None
    markup: float | None = None
    current_stock: float
    min_stock: float
    unit_id: int | None = None
    category_id: int | None = None
    deposit_id: int | None = None
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
    category: CategoryResponse | None = None
    unit: UnitResponse | None = None
    display_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


CategoryResponse.model_rebuild()
