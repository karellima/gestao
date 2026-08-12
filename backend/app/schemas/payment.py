from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PaymentCreate(BaseModel):
    transaction_id: int
    amount: float = Field(gt=0, allow_inf_nan=False)
    interest: float | None = Field(default=0, ge=0, allow_inf_nan=False)
    payment_date: datetime
    notes: str | None = None

    @field_validator("amount", "interest")
    @classmethod
    def validate_cent_precision(cls, value: float | None) -> float | None:
        if value is None:
            return value
        if Decimal(str(value)).as_tuple().exponent < -2:
            raise ValueError("Valores monetários aceitam no máximo duas casas decimais")
        return value


class PaymentResponse(BaseModel):
    id: int
    transaction_id: int
    amount: float
    interest: float
    payment_date: datetime
    notes: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
