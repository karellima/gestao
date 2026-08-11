from typing import Optional

from pydantic import BaseModel


class ContactSegmentCreate(BaseModel):
    name: str


class ContactSegmentUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class ContactSegmentResponse(BaseModel):
    id: int
    name: str
    is_active: bool

    class Config:
        from_attributes = True
