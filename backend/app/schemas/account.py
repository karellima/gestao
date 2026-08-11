from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    account_type: str  # "banco", "caixa", "cartao_credito"
    bank_name: str | None = None
    agency: str | None = None
    account_number: str | None = None
    balance: float | None = 0
    flag: str | None = None
    closing_day: int | None = None
    due_day: int | None = None
    best_purchase_day: int | None = None
    credit_limit: float | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    account_type: str | None = None
    bank_name: str | None = None
    agency: str | None = None
    account_number: str | None = None
    balance: float | None = None
    flag: str | None = None
    closing_day: int | None = None
    due_day: int | None = None
    best_purchase_day: int | None = None
    credit_limit: float | None = None
    is_active: bool | None = None


class AccountResponse(BaseModel):
    id: int
    name: str
    account_type: str
    bank_name: str | None = None
    agency: str | None = None
    account_number: str | None = None
    balance: float
    flag: str | None = None
    closing_day: int | None = None
    due_day: int | None = None
    best_purchase_day: int | None = None
    credit_limit: float | None = None
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True
