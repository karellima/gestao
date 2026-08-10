from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class StockMovementCreate(BaseModel):
    product_id: int
    deposit_id: int
    movement_type: str
    movement_date: Optional[str] = None
    quantity: float = Field(gt=0)
    unit_price: Optional[float] = 0
    reason: Optional[str] = None
    notes: Optional[str] = None


class StockMovementUpdate(BaseModel):
    product_id: Optional[int] = None
    deposit_id: Optional[int] = None
    movement_type: Optional[str] = None
    movement_date: Optional[str] = None
    quantity: Optional[float] = Field(default=None, gt=0)
    unit_price: Optional[float] = None
    reason: Optional[str] = None
    notes: Optional[str] = None


class StockMovementResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    deposit_id: int
    deposit_name: Optional[str] = None
    movement_type: str
    movement_date: Optional[datetime] = None
    quantity: float
    unit_price: float
    total_value: float
    reason: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = None
    # Preenchido quando esta linha é o estorno de outra — deixa o cliente
    # exibir o par (lançamento errado + correção) em vez de um saldo mudo.
    compensates_movement_id: Optional[int] = None
    created_at: Optional[datetime] = None
    user_id: Optional[int] = None

    class Config:
        from_attributes = True


class StockTransferItem(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)
    unit_price: Optional[float] = 0


class StockTransferCreate(BaseModel):
    source_deposit_id: int
    destination_deposit_id: int
    transfer_type: str  # "abastecimento" or "devolucao"
    items: List[StockTransferItem]


class StockAvariaCreate(BaseModel):
    deposit_id: int
    items: List[StockTransferItem]
    description: str


class StockMovementCompensate(BaseModel):
    """Estorno de uma movimentação: grava a inversa, mantém as duas no histórico."""
    reason: Optional[str] = None
    notes: Optional[str] = None


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
    reason: Optional[str] = None


class StockRepairCompensation(BaseModel):
    compensation_id: Optional[int] = None
    movement_id: int
    product_id: int
    quantity: float


class StockRepairDivergence(BaseModel):
    product_id: int
    product_name: Optional[str] = None
    current_stock: float
    derived_stock: float
    delta: float


class StockRepairResync(BaseModel):
    product_id: int
    product_name: Optional[str] = None
    from_: float = Field(alias="from")
    to: float

    class Config:
        populate_by_name = True


class StockRepairReport(BaseModel):
    dry_run: bool
    executed_at: str
    executed_by_user_id: Optional[int] = None
    orphan_requisicao_exits: List[StockRepairOrphanExit]
    stock_divergences: List[StockRepairDivergence]
    compensations_created: List[StockRepairCompensation]
    products_resynced: List[StockRepairResync]


class StockBalanceItem(BaseModel):
    product_id: int
    product_name: str
    unit_abbr: Optional[str] = None
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
    movement_date: Optional[datetime] = None
    quantity: float
    unit_price: float
    total_value: float
    reason: Optional[str] = None
    created_at: Optional[datetime] = None


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
