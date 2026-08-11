
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contact_segment import ContactSegment
from app.schemas.contact_segment import (
    ContactSegmentCreate,
    ContactSegmentResponse,
    ContactSegmentUpdate,
)
from app.utils.security import require_module

router = APIRouter(prefix="/api/contact-segments", tags=["Seguimentos"])


@router.get("/", response_model=list[ContactSegmentResponse])
def list_segments(
    db: Session = Depends(get_db),
    _=Depends(require_module("contacts")),
):
    return db.query(ContactSegment).filter(ContactSegment.is_active == True).order_by(ContactSegment.name).all()


@router.post("/", response_model=ContactSegmentResponse)
def create_segment(
    data: ContactSegmentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_module("contacts", "edit")),
):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Informe um nome para o seguimento")
    existing = db.query(ContactSegment).filter(ContactSegment.name == name).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(status_code=400, detail="Seguimento já cadastrado")
    seg = ContactSegment(name=name)
    db.add(seg)
    db.commit()
    db.refresh(seg)
    return seg


@router.put("/{segment_id}", response_model=ContactSegmentResponse)
def update_segment(
    segment_id: int,
    data: ContactSegmentUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_module("contacts", "edit")),
):
    seg = db.query(ContactSegment).filter(ContactSegment.id == segment_id).first()
    if not seg:
        raise HTTPException(status_code=404, detail="Seguimento não encontrado")
    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Informe um nome para o seguimento")
        dup = db.query(ContactSegment).filter(
            ContactSegment.name == name,
            ContactSegment.id != segment_id,
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail="Já existe um seguimento com esse nome")
        seg.name = name
    if data.is_active is not None:
        seg.is_active = data.is_active
    db.commit()
    db.refresh(seg)
    return seg


@router.delete("/{segment_id}")
def delete_segment(
    segment_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("contacts", "edit")),
):
    seg = db.query(ContactSegment).filter(ContactSegment.id == segment_id).first()
    if not seg:
        raise HTTPException(status_code=404, detail="Seguimento não encontrado")
    seg.is_active = False
    db.commit()
    return {"message": "Seguimento removido"}
