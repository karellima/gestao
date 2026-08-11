from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    data_entry_case: str | None = None  # "upper" | "title" | "free"


class SettingsResponse(BaseModel):
    data_entry_case: str = "title"
