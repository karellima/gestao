from pydantic import BaseModel, ConfigDict


class RoleModuleCreate(BaseModel):
    module: str
    access_level: str = "edit"


class RoleCreate(BaseModel):
    name: str
    is_admin: bool = False
    is_default: bool = False
    modules: list[RoleModuleCreate] = []


class RoleUpdate(BaseModel):
    name: str | None = None
    is_admin: bool | None = None
    is_default: bool | None = None
    modules: list[RoleModuleCreate] | None = None


class RoleModuleResponse(BaseModel):
    id: int
    module: str
    access_level: str

    model_config = ConfigDict(from_attributes=True)


class RoleResponse(BaseModel):
    id: int
    name: str
    is_admin: bool
    is_default: bool
    modules: list[RoleModuleResponse] = []

    model_config = ConfigDict(from_attributes=True)
