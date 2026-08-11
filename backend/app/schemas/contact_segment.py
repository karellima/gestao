from pydantic import BaseModel, ConfigDict


class ContactSegmentCreate(BaseModel):
    name: str


class ContactSegmentUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class ContactSegmentResponse(BaseModel):
    id: int
    name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
