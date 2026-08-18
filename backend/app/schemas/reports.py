from datetime import datetime

from pydantic import BaseModel


class DashboardTransaction(BaseModel):
    id: int
    description: str
    amount: float
    type: str
    due_date: datetime | None = None
    contact: str | None = None


class RecentDashboardTransaction(BaseModel):
    id: int
    description: str
    amount: float
    type: str
    status: str
    date: str | None = None
    category: str | None = None
    contact: str | None = None


class DashboardDueStats(BaseModel):
    count: int
    total: float
    list: list[DashboardTransaction]


class DashboardMonthlyEvolution(BaseModel):
    mes: str
    receitas: float
    despesas: float


class DashboardReport(BaseModel):
    total_products: int
    low_stock_products: int
    total_contacts: int
    monthly_receitas: float
    monthly_despesas: float
    monthly_balance: float
    a_pagar: float
    a_receber: float
    qtd_pendentes: int
    a_pagar_list: list[DashboardTransaction]
    a_receber_list: list[DashboardTransaction]
    despesas_por_categoria: dict[str, float]
    receitas_por_categoria: dict[str, float]
    overdue_pagar: DashboardDueStats
    overdue_receber: DashboardDueStats
    next_pagar: DashboardDueStats
    next_receber: DashboardDueStats
    next_due_total: float
    next_due_count: int
    next_due_list: list[DashboardTransaction]
    recent_transactions: list[RecentDashboardTransaction]
    monthly_evolution: list[DashboardMonthlyEvolution]


class StockMovementSummary(BaseModel):
    periodo_dias: int
    total_entradas: float
    total_saidas: float


class FinancialSummary(BaseModel):
    periodo_inicio: datetime
    periodo_fim: datetime
    total_receitas: float
    total_despesas: float
    saldo: float
