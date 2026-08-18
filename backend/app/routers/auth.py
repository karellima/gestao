
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.deposit import Deposit
from app.models.role import Role
from app.models.user import User
from app.schemas.user import (
    CurrentUserResponse,
    LoginRequest,
    Token,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.utils.security import (
    create_access_token,
    get_current_user,
    get_password_hash,
    normalizar_email,
    require_module,
    verificar_senha_descartavel,
    verify_password,
)


def _buscar_por_email(db: Session, email: str, excluir_id: int | None = None):
    """Busca sem depender de caixa.

    A comparação vai em `func.lower` dos dois lados porque a base tem e-mail
    gravado antes de existir normalização: comparar com o valor cru faria o
    usuário legado `Admin@Empresa.com` deixar de entrar no dia em que o login
    passou a minúsculo. É a mesma razão de a checagem de duplicado usar isto —
    sem ela, `admin@x.com` e `Admin@x.com` viram duas contas e o login fica
    ambíguo.
    """
    consulta = db.query(User).filter(func.lower(User.email) == normalizar_email(email))
    if excluir_id is not None:
        consulta = consulta.filter(User.id != excluir_id)
    return consulta.first()

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])


@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(require_module("users", "edit"))):

    role = db.query(Role).filter(Role.name == user.role).first()
    if not role:
        raise HTTPException(status_code=400, detail="Perfil inválido")

    if _buscar_por_email(db, user.email):
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    new_user = User(
        name=user.name,
        email=normalizar_email(user.email),
        hashed_password=get_password_hash(user.password),
        role=role.name,
    )
    db.add(new_user)
    db.flush()

    if user.deposit_ids:
        deposits = db.query(Deposit).filter(Deposit.id.in_(user.deposit_ids)).all()
        new_user.deposits = deposits

    db.commit()
    db.refresh(new_user)
    return UserResponse.from_orm_with_password(new_user)


@router.get("/users", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(require_module("users", "edit"))):
    users = db.query(User).order_by(User.name).all()
    return [UserResponse.from_orm_with_password(u) for u in users]


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(require_module("users", "edit"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if data.name is not None:
        user.name = data.name
    if data.email is not None:
        if _buscar_por_email(db, data.email, excluir_id=user_id):
            raise HTTPException(status_code=400, detail="Email já cadastrado")
        user.email = normalizar_email(data.email)
    if data.password is not None:
        user.hashed_password = get_password_hash(data.password)
    if data.role is not None:
        role = db.query(Role).filter(Role.name == data.role).first()
        if not role:
            raise HTTPException(status_code=400, detail="Perfil inválido")
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.deposit_ids is not None:
        deposits = db.query(Deposit).filter(Deposit.id.in_(data.deposit_ids)).all()
        user.deposits = deposits
    db.commit()
    db.refresh(user)
    return UserResponse.from_orm_with_password(user)


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(require_module("users", "edit"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    db.delete(user)
    db.commit()
    return {"detail": "Usuário removido"}


@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = _buscar_por_email(db, request.email)
    if not user:
        # Sem isto a conta inexistente responde na hora e a cadastrada paga o
        # bcrypt: a diferença de tempo enumera a base inteira.
        verificar_senha_descartavel(request.password)
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário desativado")

    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=CurrentUserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = db.query(Role).filter(Role.name == current_user.role).first()
    permissions = {
        module.module: module.access_level
        for module in role.modules
    } if role else {}
    return CurrentUserResponse(
        **UserResponse.from_orm_with_password(current_user).model_dump(),
        is_admin=bool(role and role.is_admin),
        permissions=permissions,
    )
