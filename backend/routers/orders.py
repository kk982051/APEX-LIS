from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import random

from database import get_db
from models import Order, Patient, Sample, ResultItem
from schemas import OrderCreate, OrderUpdate, OrderOut, OrderVerify

router = APIRouter(prefix="/orders", tags=["Orders"])

def utc_now():
    return datetime.now(timezone.utc)

def next_sequence_id(db: Session, column, prefix: str) -> str:
    """
    Returns the next "<prefix>NNN" identifier. Uses the highest existing sequence
    number rather than a row count, so deleting a record never causes a reused ID.
    """
    highest = 0
    for (value,) in db.query(column).filter(column.like(f"{prefix}%")).all():
        suffix = value[len(prefix):]
        if suffix.isdigit():
            highest = max(highest, int(suffix))
    return f"{prefix}{highest + 1:03d}"

@router.get("", response_model=List[OrderOut])
def get_orders(
    status: Optional[str] = None,
    species: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(Order).join(Patient)
    if status and status.upper() != "ALL":
        query = query.filter(Order.status == status.upper())
    if species and species.upper() != "ALL":
        query = query.filter(Patient.species == species.upper())
    if priority and priority.upper() != "ALL":
        query = query.filter(Order.priority == priority.upper())
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Order.accession_no.ilike(s)) |
            (Patient.name.ilike(s)) |
            (Patient.mrn.ilike(s)) |
            (Patient.owner_name.ilike(s)) |
            (Order.samples.any(Sample.barcode.ilike(s)))
        )
    return query.order_by(Order.id.desc()).offset(offset).limit(limit).all()


@router.post("", response_model=OrderOut)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    patient = None
    if payload.patient_id:
        patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient ID not found")
    elif payload.patient:
        # Create patient inline
        mrn = payload.patient.mrn or next_sequence_id(db, Patient.mrn, f"PAT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-")
        if db.query(Patient).filter(Patient.mrn == mrn).first():
            raise HTTPException(status_code=400, detail=f"Patient with MRN '{mrn}' already exists.")
        patient = Patient(
            mrn=mrn,
            name=payload.patient.name,
            species=payload.patient.species.upper(),
            breed=payload.patient.breed,
            age_years=payload.patient.age_years,
            age_months=payload.patient.age_months,
            gender=payload.patient.gender,
            microchip_id=payload.patient.microchip_id,
            owner_name=payload.patient.owner_name,
            owner_phone=payload.patient.owner_phone,
            owner_email=payload.patient.owner_email
        )
        db.add(patient)
        db.flush()
    else:
        raise HTTPException(status_code=400, detail="Must provide patient_id or patient object")

    # Generate unique accession number
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    accession_no = next_sequence_id(db, Order.accession_no, f"ORD-{today_str}-")

    panels_str = ", ".join(payload.panel_types) if payload.panel_types else "CBC"
    draw_dt = payload.draw_date or utc_now()

    order = Order(
        accession_no=accession_no,
        patient_id=patient.id,
        order_date=utc_now(),
        draw_date=draw_dt,
        priority=payload.priority.upper(),
        status="PENDING",
        panel_types=panels_str,
        clinical_notes=payload.clinical_notes
    )
    db.add(order)
    db.flush()

    # Automatically generate required sample tubes based on panel types
    panels_upper = [p.upper() for p in payload.panel_types]
    created_tubes = set()

    rand_sfx = f"{random.randint(100000, 999999)}"
    if any("CBC" in p or "HEM" in p for p in panels_upper) or not panels_upper:
        s_edta = Sample(
            order_id=order.id,
            barcode=f"HEM{rand_sfx}",
            tube_type="EDTA_LAVENDER",
            specimen_type="WHOLE_BLOOD",
            draw_date=draw_dt,
            status="COLLECTED"
        )
        db.add(s_edta)
        created_tubes.add("EDTA")

    if any("CHEM" in p or "LFT" in p or "KFT" in p or "LIVER" in p or "RENAL" in p or "ELEC" in p for p in panels_upper):
        s_serum = Sample(
            order_id=order.id,
            barcode=f"CHM{rand_sfx}",
            tube_type="SERUM_RED",
            specimen_type="SERUM",
            draw_date=draw_dt,
            status="COLLECTED"
        )
        db.add(s_serum)
        created_tubes.add("SERUM")

    if not created_tubes:
        s_gen = Sample(
            order_id=order.id,
            barcode=f"SMP{rand_sfx}",
            tube_type="EDTA_LAVENDER",
            specimen_type="WHOLE_BLOOD",
            draw_date=draw_dt,
            status="COLLECTED"
        )
        db.add(s_gen)

    db.commit()
    db.refresh(order)
    return order


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/{order_id}", response_model=OrderOut)
def update_order(order_id: int, payload: OrderUpdate, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if payload.draw_date is not None:
        order.draw_date = payload.draw_date
        # update sample draw dates
        for s in order.samples:
            s.draw_date = payload.draw_date
    if payload.order_date is not None:
        order.order_date = payload.order_date
    if payload.priority is not None:
        order.priority = payload.priority.upper()
    if payload.clinical_notes is not None:
        order.clinical_notes = payload.clinical_notes
    if payload.panel_types is not None:
        order.panel_types = payload.panel_types
    if payload.status is not None:
        order.status = payload.status.upper()

    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
    return {"status": "DELETED", "order_id": order_id}
