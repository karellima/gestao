from fastapi import APIRouter

from app.routers.requisicoes import crud, workflow

router = APIRouter(prefix="/api/requisicoes", tags=["Requisições de Estoque"])
router.include_router(crud.router)
router.include_router(workflow.router)
