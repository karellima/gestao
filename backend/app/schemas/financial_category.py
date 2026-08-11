from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class FinancialCategoryCreate(BaseModel):
    name: str
    description: str | None = None
    type: str  # "receita" ou "despesa"
    parent_id: int | None = None


class FinancialCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    type: str | None = None
    parent_id: int | None = None


class FinancialCategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    type: str
    parent_id: int | None = None
    is_active: bool
    created_at: datetime | None = None
    subcategories: list["FinancialCategoryResponse"] = []

    class Config:
        from_attributes = True


FinancialCategoryResponse.model_rebuild()
