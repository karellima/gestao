from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class RecurrenceFrequencyCreate(BaseModel):
    name: str
    days_interval: int
    is_active: bool | None = True


class RecurrenceFrequencyUpdate(BaseModel):
    name: str | None = None
    days_interval: int | None = None
    is_active: bool | None = None


class RecurrenceFrequencyResponse(BaseModel):
    id: int
    name: str
    days_interval: int
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True
