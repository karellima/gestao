from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StockMovementCreate(BaseModel):
    product_id: int
    deposit_id: int
    movement_type: str
    movement_date: str | None = None
    quantity: float = Field(gt=0)
    unit_price: float | None = 0
    reason: str | None = None
    notes: str | None = None


class StockMovementUpdate(BaseModel):
    product_id: int | None = None
    deposit_id: int | None = None
    movement_type: str | None = None
    movement_date: str | None = None
    quantity: float | None = Field(default=None, gt=0)
    unit_price: float | None = None
    reason: str | None = None
    notes: str | None = None


class StockMovementResponse(BaseModel):
    id: int
    product_id: int
    product_name: str | None = None
    deposit_id: int
    deposit_name: str | None = None
    movement_type: str
    movement_date: datetime | None = None
    quantity: float
    unit_price: float
    total_value: float
    reason: str | None = None
    notes: str | None = None
    source: str | None = None
    # Preenchido quando esta linha é o estorno de outra — deixa o cliente
    # exibir o par (lançamento errado + correção) em vez de um saldo mudo.
    compensates_movement_id: int | None = None
    created_at: datetime | None = None
    user_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class StockTransferItem(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)
    unit_price: float | None = 0


class StockTransferCreate(BaseModel):
    source_deposit_id: int
    destination_deposit_id: int
    transfer_type: str  # "abastecimento" or "devolucao"
    items: list[StockTransferItem]


class StockAvariaCreate(BaseModel):
    deposit_id: int
    items: list[StockTransferItem]
    description: str


class StockMovementCompensate(BaseModel):
    """Estorno de uma movimentação: grava a inversa, mantém as duas no histórico."""
    reason: str | None = None
    notes: str | None = None


class StockRepairRequest(BaseModel):
    """Reparo sob demanda. Simula por padrão — só grava com ``dry_run=False``."""
    dry_run: bool = True
    compensate_orphans: bool = True
    resync_cache: bool = True


class StockRepairOrphanExit(BaseModel):
    movement_id: int
    requisicao_id: int
    product_id: int
    deposit_id: int
    quantity: float
    reason: str | None = None


class StockRepairCompensation(BaseModel):
    compensation_id: int | None = None
    movement_id: int
    product_id: int
    quantity: float


class StockRepairDivergence(BaseModel):
    product_id: int
    product_name: str | None = None
    current_stock: float
    derived_stock: float
    delta: float


class StockRepairResync(BaseModel):
    product_id: int
    product_name: str | None = None
    from_: float = Field(alias="from")
    to: float

    model_config = ConfigDict(populate_by_name=True)


class StockRepairReport(BaseModel):
    dry_run: bool
    executed_at: str
    executed_by_user_id: int | None = None
    orphan_requisicao_exits: list[StockRepairOrphanExit]
    stock_divergences: list[StockRepairDivergence]
    compensations_created: list[StockRepairCompensation]
    products_resynced: list[StockRepairResync]


class StockBalanceItem(BaseModel):
    product_id: int
    product_name: str
    unit_abbr: str | None = None
    quantity_entries: float
    quantity_exits: float
    balance: float
    total_value_entries: float
    total_value_exits: float


class StockMovementReportItem(BaseModel):
    id: int
    product_id: int
    product_name: str
    deposit_id: int
    deposit_name: str
    movement_type: str
    movement_date: datetime | None = None
    quantity: float
    unit_price: float
    total_value: float
    reason: str | None = None
    created_at: datetime | None = None


class TransferReportItem(BaseModel):
    deposit_id: int
    deposit_name: str
    product_id: int
    product_name: str
    abastecimento_qty: float
    devolucao_qty: float
    avaria_qty: float
    venda_qty: float
    unit_price: float
    venda_total: float
