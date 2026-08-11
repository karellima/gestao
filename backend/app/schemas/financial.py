from datetime import datetime

from pydantic import BaseModel, ConfigDict


class Payment简(BaseModel):
    id: int
    amount: float
    interest: float
    payment_date: datetime
    notes: str | None = None
    model_config = ConfigDict(from_attributes=True)


class FinancialCategory简(BaseModel):
    id: int
    name: str
    type: str | None = None
    parent_id: int | None = None
    model_config = ConfigDict(from_attributes=True)


class PaymentType简(BaseModel):
    id: int
    name: str
    requires_installments: bool | None = None
    model_config = ConfigDict(from_attributes=True)


class Account简(BaseModel):
    id: int
    name: str
    account_type: str | None = None
    bank_name: str | None = None
    flag: str | None = None
    model_config = ConfigDict(from_attributes=True)


class Contact简(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)


class TransactionCreate(BaseModel):
    type: str
    financial_category_id: int | None = None
    description: str
    amount: float
    date: datetime
    due_date: datetime | None = None
    payment_type_id: int | None = None
    account_id: int | None = None
    contact_id: int | None = None
    installments: int | None = 1
    current_installment: int | None = 1
    recurrence_frequency: str | None = None
    notes: str | None = None


class TransactionUpdate(BaseModel):
    type: str | None = None
    financial_category_id: int | None = None
    description: str | None = None
    amount: float | None = None
    date: datetime | None = None
    due_date: datetime | None = None
    payment_type_id: int | None = None
    account_id: int | None = None
    contact_id: int | None = None
    installments: int | None = None
    current_installment: int | None = None
    recurrence_frequency: str | None = None
    notes: str | None = None


class TransactionResponse(BaseModel):
    id: int
    type: str
    financial_category_id: int | None = None
    description: str
    amount: float
    date: datetime
    due_date: datetime | None = None
    payment_type_id: int | None = None
    account_id: int | None = None
    contact_id: int | None = None
    installments: int
    current_installment: int
    recurrence_frequency: str | None = None
    status: str | None = "pendente"
    notes: str | None = None
    created_at: datetime | None = None
    financial_category: FinancialCategory简 | None = None
    payment_type: PaymentType简 | None = None
    account: Account简 | None = None
    contact: Contact简 | None = None
    payments: list[Payment简] | None = []

    model_config = ConfigDict(from_attributes=True)
