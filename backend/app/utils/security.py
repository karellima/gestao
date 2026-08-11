from datetime import datetime, timedelta
from typing import List, Optional, Callable
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.config import SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import get_db
from app.models.user import User
from app.models.role import Role, RoleModule

ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário desativado")
    return user


def is_admin_user(db: Session, user: User) -> bool:
    role = db.query(Role).filter(Role.name == user.role).first()
    return bool(role and role.is_admin)


def user_deposit_ids(user: User) -> List[int]:
    """Depósitos que o usuário enxerga — o escopo de tudo que não é admin.

    Lista vazia quer dizer "nenhum depósito", não "todos": quem chama filtra
    por ela e devolve nada. Fica aqui, e não em cada router, porque um segundo
    jeito de responder a mesma pergunta é um segundo jeito de vazar dado de
    depósito alheio.
    """
    return [d.id for d in user.deposits] if user.deposits else []


def require_module(module: str, access_level: str = "view") -> Callable:
    def checker(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        role = db.query(Role).filter(Role.name == current_user.role).first()
        if not role:
            raise HTTPException(status_code=403, detail="Perfil de acesso não configurado")
        if role.is_admin:
            return current_user
        perm = db.query(RoleModule).filter(
            RoleModule.role_id == role.id,
            RoleModule.module == module,
        ).first()
        if not perm:
            raise HTTPException(status_code=403, detail=f"Acesso negado ao módulo '{module}'")
        levels = {"view": 0, "edit": 1}
        if levels.get(perm.access_level, 0) < levels.get(access_level, 0):
            raise HTTPException(status_code=403, detail=f"Permissão insuficiente no módulo '{module}'")
        return current_user
    return checker


def require_admin(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    """Restringe a operação a administradores.

    Usado por operações de manutenção (ex.: reparo de estoque) que escrevem no
    histórico em nome do sistema e não pertencem a nenhum módulo de negócio.
    """
    if not is_admin_user(db, current_user):
        raise HTTPException(status_code=403, detail="Operação restrita a administradores")
    return current_user


def require_any_module(modules, access_level: str = "view") -> Callable:
    def checker(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        role = db.query(Role).filter(Role.name == current_user.role).first()
        if not role:
            raise HTTPException(status_code=403, detail="Perfil de acesso não configurado")
        if role.is_admin:
            return current_user
        levels = {"view": 0, "edit": 1}
        for module in modules:
            perm = db.query(RoleModule).filter(
                RoleModule.role_id == role.id,
                RoleModule.module == module,
            ).first()
            if perm and levels.get(perm.access_level, 0) >= levels.get(access_level, 0):
                return current_user
        raise HTTPException(status_code=403, detail=f"Acesso negado aos módulos {', '.join(modules)}")
    return checker
