from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RequisicaoItemCreate(BaseModel):
    product_id: int
    quantity_requested: float = Field(gt=0)
    unit_price: float | None = None


class RequisicaoItemUpdate(BaseModel):
    id: int | None = None
    product_id: int | None = None
    quantity_requested: float | None = None
    quantity_approved: float | None = None
    unit_price: float | None = None


class RequisicaoItemResponse(BaseModel):
    id: int
    requisicao_id: int
    product_id: int
    product_name: str | None = None
    quantity_requested: float
    quantity_approved: float | None = None
    quantity_fulfilled: float = 0
    quantity_received: float = 0
    unit_price: float | None = None

    model_config = ConfigDict(from_attributes=True)


class RequisicaoCreate(BaseModel):
    deposit_requesting_id: int
    deposit_fulfilling_id: int
    reason: str | None = None
    notes: str | None = None
    items: list[RequisicaoItemCreate]


class RequisicaoUpdate(BaseModel):
    deposit_requesting_id: int | None = None
    deposit_fulfilling_id: int | None = None
    status: str | None = None
    reason: str | None = None
    notes: str | None = None
    items: list[RequisicaoItemUpdate] | None = None


class RequisicaoApprove(BaseModel):
    items: list[RequisicaoItemUpdate]


class RequisicaoItemFulfill(BaseModel):
    product_id: int
    quantity_fulfilled: float = Field(gt=0)


class RequisicaoFulfill(BaseModel):
    items: list[RequisicaoItemFulfill]


class RequisicaoItemReceive(BaseModel):
    product_id: int
    quantity_received: float = Field(gt=0)


class RequisicaoReceive(BaseModel):
    items: list[RequisicaoItemReceive]


class RequisicaoResponse(BaseModel):
    id: int
    requester_id: int
    requester_name: str | None = None
    approver_id: int | None = None
    approver_name: str | None = None
    deposit_requesting_id: int
    deposit_requesting_name: str | None = None
    deposit_fulfilling_id: int
    deposit_fulfilling_name: str | None = None
    status: str
    reason: str | None = None
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    items: list[RequisicaoItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
