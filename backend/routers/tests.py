from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import TestMaster, TestReferenceRange
from schemas import TestMasterOut, TestReferenceRangeBase

router = APIRouter(prefix="/tests", tags=["Tests"])

@router.get("", response_model=List[TestMasterOut])
def get_test_catalog(
    category: Optional[str] = None,
    species: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TestMaster)
    if category and category.upper() != "ALL":
        query = query.filter(TestMaster.category == category.upper())
    return query.order_by(TestMaster.print_order.asc(), TestMaster.code.asc()).all()

@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    cats = db.query(TestMaster.category).distinct().all()
    return [c[0] for c in cats if c[0]]

@router.put("/{test_code}/ranges/{species}")
def update_test_range(
    test_code: str,
    species: str,
    payload: TestReferenceRangeBase,
    db: Session = Depends(get_db)
):
    tm = db.query(TestMaster).filter(TestMaster.code == test_code.upper()).first()
    if not tm:
        raise HTTPException(status_code=404, detail=f"Test master '{test_code}' not found")

    ref = db.query(TestReferenceRange).filter(
        TestReferenceRange.test_master_id == tm.id,
        TestReferenceRange.species == species.upper()
    ).first()

    if not ref:
        ref = TestReferenceRange(
            test_master_id=tm.id,
            species=species.upper(),
            low_val=payload.low_val,
            high_val=payload.high_val,
            critical_low=payload.critical_low,
            critical_high=payload.critical_high,
            unit=payload.unit or tm.default_unit
        )
        db.add(ref)
    else:
        ref.low_val = payload.low_val
        ref.high_val = payload.high_val
        ref.critical_low = payload.critical_low
        ref.critical_high = payload.critical_high
        if payload.unit:
            ref.unit = payload.unit

    db.commit()
    return {"status": "UPDATED", "test_code": test_code, "species": species}
