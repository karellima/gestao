from datetime import datetime

from pydantic import BaseModel, ConfigDict


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

    model_config = ConfigDict(from_attributes=True)
