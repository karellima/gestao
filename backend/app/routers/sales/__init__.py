from fastapi import APIRouter

from app.routers.sales import lancamentos, tipos

sale_type_router = APIRouter(prefix="/api/sale-types", tags=["Tipos de Lançamento"])
sale_type_router.include_router(tipos.router)

sale_router = APIRouter(prefix="/api/sales", tags=["Lançamentos"])
sale_router.include_router(lancamentos.router)

__all__ = ["sale_router", "sale_type_router"]
