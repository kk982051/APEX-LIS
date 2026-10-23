from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import ClinicSettings

router = APIRouter(prefix="/settings", tags=["Clinic Settings"])

class ClinicSettingsUpdate(BaseModel):
    clinic_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    license_no: Optional[str] = None
    accreditation: Optional[str] = None
    auto_batch_approve: Optional[bool] = None

@router.get("")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(ClinicSettings).first()
    if not settings:
        settings = ClinicSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return {
        "id": settings.id,
        "clinic_name": settings.clinic_name,
        "address": settings.address,
        "phone": settings.phone,
        "email": settings.email,
        "license_no": settings.license_no,
        "accreditation": settings.accreditation,
        "auto_batch_approve": settings.auto_batch_approve
    }

@router.put("")
def update_settings(payload: ClinicSettingsUpdate, db: Session = Depends(get_db)):
    settings = db.query(ClinicSettings).first()
    if not settings:
        settings = ClinicSettings()
        db.add(settings)

    if payload.clinic_name is not None:
        settings.clinic_name = payload.clinic_name
    if payload.address is not None:
        settings.address = payload.address
    if payload.phone is not None:
        settings.phone = payload.phone
    if payload.email is not None:
        settings.email = payload.email
    if payload.license_no is not None:
        settings.license_no = payload.license_no
    if payload.accreditation is not None:
        settings.accreditation = payload.accreditation
    if payload.auto_batch_approve is not None:
        settings.auto_batch_approve = payload.auto_batch_approve

    db.commit()
    db.refresh(settings)

    return {
        "status": "UPDATED",
        "settings": {
            "id": settings.id,
            "clinic_name": settings.clinic_name,
            "address": settings.address,
            "phone": settings.phone,
            "email": settings.email,
            "license_no": settings.license_no,
            "accreditation": settings.accreditation,
            "auto_batch_approve": settings.auto_batch_approve
        }
    }
