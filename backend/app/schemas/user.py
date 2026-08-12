from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str | None = "user"
    deposit_ids: list[int] | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    role: str | None = None
    is_active: bool | None = None
    deposit_ids: list[int] | None = None


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
    email: str
    password: str
