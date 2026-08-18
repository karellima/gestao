from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY
from app.database import get_db
from app.models.role import Role, RoleModule
from app.models.user import User

ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


#: O bcrypt só considera os primeiros 72 bytes do segredo e, desde a versão 4,
#: levanta `ValueError` em vez de truncar sozinho. Quem recebe esse erro aqui é
#: o handler global, que responde `500`.
#:
#: No login isso era pior do que uma resposta feia. O `verify_password` só é
#: chamado quando o e-mail existe, então uma senha de 200 bytes separava as
#: contas em dois grupos: `401` para quem não está cadastrado, `500` para quem
#: está. Um oráculo de enumeração binário, sem ruído, sem precisar cronometrar
#: nada — e aberto a qualquer um, sem autenticação.
#:
#: Truncar aqui, nos dois sentidos, devolve o comportamento que o bcrypt tinha
#: antes da 4 e que o resto do mundo assume: o que passa de 72 bytes não entra
#: na conta, mas também não derruba a requisição. Cortar em bytes pode partir um
#: caractere multibyte ao meio; para o bcrypt o segredo é opaco, então a metade
#: continua sendo um byte válido de entrada. O importante é que hash e
#: verificação cortem no mesmo lugar.
#:
#: Isto não substitui limite de tamanho no schema — recusar cedo, com mensagem
#: clara, é trabalho de quem valida a entrada. É a rede embaixo dele.
BCRYPT_MAX_BYTES = 72


def _segredo_para_bcrypt(password: str) -> bytes:
    return password.encode("utf-8")[:BCRYPT_MAX_BYTES]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(_segredo_para_bcrypt(plain_password), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(_segredo_para_bcrypt(password), bcrypt.gensalt()).decode("utf-8")


#: Hash descartável, gerado uma vez na subida do processo, contra o qual o login
#: verifica quando o e-mail não existe.
#:
#: Sem isto o tempo de resposta separa as contas: e-mail inexistente volta na
#: hora, porque o `verify_password` nunca chega a rodar, enquanto e-mail
#: cadastrado paga os ~100-300 ms do bcrypt. Quem mede a diferença enumera a
#: base sem precisar de nenhuma resposta diferente do servidor. A senha aqui é
#: irrelevante — o que importa é o custo, e ele é o mesmo do hash real porque
#: sai do mesmo `gensalt()`.
_HASH_DESCARTAVEL = bcrypt.hashpw(b"conta-inexistente", bcrypt.gensalt()).decode("utf-8")


def verificar_senha_descartavel(plain_password: str) -> None:
    """Paga o custo de um bcrypt sem revelar nada. Usada quando o e-mail não existe."""
    verify_password(plain_password, _HASH_DESCARTAVEL)


def normalizar_email(email: str) -> str:
    """Forma canônica de um e-mail para busca e comparação.

    `strip` + `lower` porque quem digita o próprio e-mail no celular manda
    `` Admin@Empresa.com `` e espera entrar. Fica aqui, e não dentro do router,
    porque o rate limit do login precisa chavear pela mesma forma canônica: dois
    jeitos de normalizar são dois baldes distintos para a mesma conta, e o
    atacante escolhe o mais vazio.
    """
    return email.strip().lower()


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
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
    except (JWTError, ValueError) as error:
        raise credentials_exception from error

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário desativado")
    return user


def is_admin_user(db: Session, user: User) -> bool:
    role = db.query(Role).filter(Role.name == user.role).first()
    return bool(role and role.is_admin)


def user_deposit_ids(user: User) -> list[int]:
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
