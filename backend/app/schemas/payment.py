from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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

    class Config:
        from_attributes = True
