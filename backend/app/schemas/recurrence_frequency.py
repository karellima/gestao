from datetime import datetime

from pydantic import BaseModel, ConfigDict


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

    model_config = ConfigDict(from_attributes=True)
