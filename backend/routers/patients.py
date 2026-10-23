from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from database import get_db
from models import Patient
from schemas import PatientCreate, PatientOut

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("", response_model=List[PatientOut])
def get_patients(
    search: Optional[str] = None,
    species: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(Patient)
    if species and species.upper() != "ALL":
        query = query.filter(Patient.species == species.upper())
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Patient.name.ilike(s)) |
            (Patient.mrn.ilike(s)) |
            (Patient.owner_name.ilike(s)) |
            (Patient.microchip_id.ilike(s))
        )
    return query.order_by(Patient.id.desc()).offset(offset).limit(limit).all()

@router.post("", response_model=PatientOut)
def create_patient(patient_in: PatientCreate, db: Session = Depends(get_db)):
    mrn = patient_in.mrn
    if not mrn:
        mrn = f"PAT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{db.query(Patient).count() + 1:03d}"
    
    # Check MRN uniqueness
    existing = db.query(Patient).filter(Patient.mrn == mrn).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Patient with MRN '{mrn}' already exists.")

    patient = Patient(
        mrn=mrn,
        name=patient_in.name,
        species=patient_in.species.upper(),
        breed=patient_in.breed,
        age_years=patient_in.age_years,
        age_months=patient_in.age_months,
        gender=patient_in.gender,
        microchip_id=patient_in.microchip_id,
        owner_name=patient_in.owner_name,
        owner_phone=patient_in.owner_phone,
        owner_email=patient_in.owner_email
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient

@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    return p

@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: int, p_in: PatientCreate, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    p.name = p_in.name
    p.species = p_in.species.upper()
    p.breed = p_in.breed
    p.age_years = p_in.age_years
    p.age_months = p_in.age_months
    p.gender = p_in.gender
    p.microchip_id = p_in.microchip_id
    p.owner_name = p_in.owner_name
    p.owner_phone = p_in.owner_phone
    p.owner_email = p_in.owner_email
    db.commit()
    db.refresh(p)
    return p
