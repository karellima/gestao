
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactResponse, ContactUpdate
from app.utils.security import require_module

router = APIRouter(prefix="/api/contacts", tags=["Clientes/Fornecedores"])


@router.get("/", response_model=list[ContactResponse])
def list_contacts(
    skip: int = 0,
    limit: int = 100,
    contact_type: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_module("contacts")),
):
    query = db.query(Contact).filter(Contact.is_active == True)
    if contact_type:
        query = query.filter(Contact.contact_type == contact_type)
    if search:
        query = query.filter(Contact.name.ilike(f"%{search}%"))
    return query.offset(skip).limit(limit).all()


@router.get("/{contact_id}", response_model=ContactResponse)
def get_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("contacts")),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    return contact


@router.post("/", response_model=ContactResponse)
def create_contact(
    contact: ContactCreate,
    db: Session = Depends(get_db),
    _=Depends(require_module("contacts", "edit")),
):
    db_contact = Contact(**contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact


@router.put("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: int,
    contact: ContactUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_module("contacts", "edit")),
):
    db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado")

    for key, value in contact.model_dump(exclude_unset=True).items():
        setattr(db_contact, key, value)

    db.commit()
    db.refresh(db_contact)
    return db_contact


@router.delete("/{contact_id}")
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("contacts", "edit")),
):
    db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado")

    db_contact.is_active = False
    db.commit()
    return {"message": "Contato removido"}
