from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PaymentCreate(BaseModel):
    transaction_id: int
    amount: float
    interest: float | None = 0
    payment_date: datetime
    notes: str | None = None


class PaymentResponse(BaseModel):
    id: int
    transaction_id: int
    amount: float
    interest: float
    payment_date: datetime
    notes: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
