from fastapi import APIRouter

from app.routers.reports import dashboard, estoque, excel, financeiro

router = APIRouter(prefix="/api/reports", tags=["Relatórios"])
router.include_router(dashboard.router)
router.include_router(financeiro.router)
router.include_router(estoque.router)
router.include_router(excel.router)
