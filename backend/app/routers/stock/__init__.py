from fastapi import APIRouter

from app.routers.stock import avarias, balance, movements, repair, transfers

router = APIRouter(prefix="/api/stock", tags=["Estoque"])
router.include_router(movements.router)
router.include_router(balance.router)
router.include_router(transfers.router)
router.include_router(avarias.router)
router.include_router(repair.router)
