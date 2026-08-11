from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import Setting
from app.schemas.settings import SettingsResponse, SettingsUpdate
from app.utils.security import get_current_user, require_module

router = APIRouter(prefix="/api/settings", tags=["Configurações"])

DEFAULT_DATA_ENTRY_CASE = "title"
ALLOWED_DATA_ENTRY_CASE = {"upper", "title", "free"}


def _get_value(db: Session, key: str, default: str) -> str:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else default


@router.get("/", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return SettingsResponse(data_entry_case=_get_value(db, "data_entry_case", DEFAULT_DATA_ENTRY_CASE))


@router.put("/", response_model=SettingsResponse)
def update_settings(
    data: SettingsUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_module("settings", "edit")),
):
    value = data.data_entry_case or DEFAULT_DATA_ENTRY_CASE
    if value not in ALLOWED_DATA_ENTRY_CASE:
        raise HTTPException(status_code=400, detail="Opção de caixa de texto inválida")

    row = db.query(Setting).filter(Setting.key == "data_entry_case").first()
    if row:
        row.value = value
    else:
        db.add(Setting(key="data_entry_case", value=value))
    db.commit()
    return SettingsResponse(data_entry_case=value)
