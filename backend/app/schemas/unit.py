from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UnitCreate(BaseModel):
    name: str
    abbreviation: str


class UnitUpdate(BaseModel):
    name: str | None = None
    abbreviation: str | None = None


class UnitResponse(BaseModel):
    id: int
    name: str
    abbreviation: str
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True
