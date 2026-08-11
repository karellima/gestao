
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.role import Role, RoleModule
from app.models.user import User
from app.schemas.role import RoleCreate, RoleResponse, RoleUpdate
from app.utils.security import get_current_user, require_module

router = APIRouter(prefix="/api/roles", tags=["Perfis de Acesso"])


def _role_to_response(r: Role) -> RoleResponse:
    return RoleResponse(
        id=r.id,
        name=r.name,
        is_admin=r.is_admin,
        is_default=r.is_default,
        modules=[{"id": m.id, "module": m.module, "access_level": m.access_level} for m in r.modules],
    )


@router.get("/", response_model=list[RoleResponse])
def list_roles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(require_module("roles"))):
    roles = db.query(Role).order_by(Role.name).all()
    return [_role_to_response(r) for r in roles]


@router.post("/", response_model=RoleResponse, status_code=201)
def create_role(data: RoleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(require_module("roles", "edit"))):
    existing = db.query(Role).filter(Role.name == data.name).first()
    if existing:
        raise HTTPException(400, "Perfil já existe")
    role = Role(name=data.name, is_admin=data.is_admin, is_default=data.is_default)
    db.add(role)
    db.flush()
    for m in data.modules:
        db.add(RoleModule(role_id=role.id, module=m.module, access_level=m.access_level))
    db.commit()
    db.refresh(role)
    return _role_to_response(role)


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(role_id: int, data: RoleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(require_module("roles", "edit"))):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "Perfil não encontrado")
    if data.name is not None:
        existing = db.query(Role).filter(Role.name == data.name, Role.id != role_id).first()
        if existing:
            raise HTTPException(400, "Nome de perfil já existe")
        role.name = data.name
    if data.is_admin is not None:
        role.is_admin = data.is_admin
    if data.is_default is not None:
        role.is_default = data.is_default
    if data.modules is not None:
        db.query(RoleModule).filter(RoleModule.role_id == role_id).delete()
        for m in data.modules:
            db.add(RoleModule(role_id=role_id, module=m.module, access_level=m.access_level))
    db.commit()
    db.refresh(role)
    return _role_to_response(role)


@router.delete("/{role_id}")
def delete_role(role_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(require_module("roles", "edit"))):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "Perfil não encontrado")
    users_with_role = db.query(User).filter(User.role == role.name).count()
    if users_with_role > 0:
        raise HTTPException(400, f"Existem {users_with_role} usuário(s) com este perfil. Remova-os antes.")
    db.delete(role)
    db.commit()
    return {"detail": "Perfil removido"}
