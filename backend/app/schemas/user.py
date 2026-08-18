from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

#: Regra de senha **nova**. Senha já cadastrada não passa por aqui: ninguém é
#: obrigado a trocar nada, e o administrador atual continua entrando com a senha
#: que tem hoje.
#:
#: O máximo é em bytes, não em caracteres, porque o limite real é do bcrypt — 72
#: bytes, e um acento gasta dois. `app/utils/security.py` ainda corta nesse mesmo
#: ponto como rede; o que muda aqui é o usuário receber uma recusa explicável em
#: vez de uma senha truncada em silêncio.
SENHA_MIN_CARACTERES = 12
SENHA_MAX_BYTES = 72


def _validar_senha_nova(valor: str | None) -> str | None:
    if valor is None:
        return valor
    if len(valor) < SENHA_MIN_CARACTERES:
        raise ValueError(f"A senha precisa de pelo menos {SENHA_MIN_CARACTERES} caracteres.")
    if len(valor.encode("utf-8")) > SENHA_MAX_BYTES:
        raise ValueError(
            f"A senha pode ter no máximo {SENHA_MAX_BYTES} bytes "
            "(acentos e emoji contam mais de um byte)."
        )
    return valor


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str | None = "user"
    deposit_ids: list[int] | None = None

    _valida_senha = field_validator("password")(_validar_senha_nova)


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    role: str | None = None
    is_active: bool | None = None
    deposit_ids: list[int] | None = None

    _valida_senha = field_validator("password")(_validar_senha_nova)


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool = True
    has_password: bool = True
    deposit_ids: list[int] = []
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_with_password(cls, user):
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            has_password=bool(user.hashed_password),
            deposit_ids=[d.id for d in user.deposits] if user.deposits else [],
            created_at=user.created_at,
        )


class CurrentUserResponse(UserResponse):
    is_admin: bool = False
    permissions: dict[str, str] = Field(default_factory=dict)


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginRequest(BaseModel):
    #: `EmailStr` aqui, e não `str`, para o resto do arquivo valer também na
    #: porta de entrada. A senha continua sem limite de tamanho de propósito:
    #: aplicar a regra de senha nova ao login trancaria para fora todo mundo
    #: cadastrado antes dela.
    email: EmailStr
    password: str
