from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DepositCreate(BaseModel):
    name: str
    description: str | None = None
    address: str | None = None
    parent_id: int | None = None


class DepositUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    address: str | None = None
    parent_id: int | None = None
    is_active: bool | None = None


class DepositResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    address: str | None = None
    parent_id: int | None = None
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True
