from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from database import get_db
from models import QCLot, QCRun
from schemas import QCLotOut, QCLotCreate, QCRunOut, QCRunCreate
from analyzer_engine.delta_checker import evaluate_westgard_rules

router = APIRouter(prefix="/qc", tags=["Quality Control"])

def utc_now():
    return datetime.now(timezone.utc)

@router.get("/lots", response_model=List[QCLotOut])
def get_qc_lots(analyzer: Optional[str] = None, active_only: bool = True, db: Session = Depends(get_db)):
    query = db.query(QCLot)
    if active_only:
        query = query.filter(QCLot.is_active == True)
    if analyzer:
        query = query.filter(QCLot.analyzer_name.ilike(f"%{analyzer}%"))
    return query.order_by(QCLot.id.desc()).all()


@router.post("/lots", response_model=QCLotOut)
def create_qc_lot(payload: QCLotCreate, db: Session = Depends(get_db)):
    existing = db.query(QCLot).filter(QCLot.lot_number == payload.lot_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="QC Lot number already exists")
    
    lot = QCLot(
        lot_number=payload.lot_number,
        analyzer_name=payload.analyzer_name,
        test_code=payload.test_code.upper(),
        level=payload.level,
        target_mean=payload.target_mean,
        target_sd=payload.target_sd,
        expiration_date=payload.expiration_date,
        is_active=payload.is_active
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot


@router.get("/lots/{lot_id}/levey-jennings")
def get_levey_jennings_data(lot_id: int, db: Session = Depends(get_db)):
    lot = db.query(QCLot).filter(QCLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="QC Lot not found")

    runs = db.query(QCRun).filter(QCRun.qc_lot_id == lot_id).order_by(QCRun.run_time.asc()).all()

    # Calculate statistics
    values = [r.value for r in runs]
    n = len(values)
    calc_mean = (sum(values) / n) if n > 0 else lot.target_mean
    
    calc_sd = 0.0
    if n > 1:
        variance = sum((x - calc_mean) ** 2 for x in values) / (n - 1)
        calc_sd = variance ** 0.5
    else:
        calc_sd = lot.target_sd

    cv_percent = (calc_sd / calc_mean * 100.0) if calc_mean > 0 else 0.0

    # Format points for charting
    chart_points = []
    for r in runs:
        chart_points.append({
            "id": r.id,
            "run_time": r.run_time.strftime("%Y-%m-%d %H:%M"),
            "value": r.value,
            "z_score": r.z_score,
            "status": r.status,
            "rule_violated": r.rule_violated,
            "operator": r.operator,
            "notes": r.notes
        })

    return {
        "lot_id": lot.id,
        "lot_number": lot.lot_number,
        "analyzer_name": lot.analyzer_name,
        "test_code": lot.test_code,
        "level": lot.level,
        "target_mean": lot.target_mean,
        "target_sd": lot.target_sd,
        "limits": {
            "mean": lot.target_mean,
            "plus_1sd": round(lot.target_mean + lot.target_sd, 3),
            "minus_1sd": round(lot.target_mean - lot.target_sd, 3),
            "plus_2sd": round(lot.target_mean + (2 * lot.target_sd), 3),
            "minus_2sd": round(lot.target_mean - (2 * lot.target_sd), 3),
            "plus_3sd": round(lot.target_mean + (3 * lot.target_sd), 3),
            "minus_3sd": round(lot.target_mean - (3 * lot.target_sd), 3),
        },
        "statistics": {
            "total_runs": n,
            "calculated_mean": round(calc_mean, 3),
            "calculated_sd": round(calc_sd, 3),
            "cv_percent": round(cv_percent, 2),
            "rejections": sum(1 for r in runs if r.status == "REJECT"),
            "warnings": sum(1 for r in runs if r.status == "WARNING")
        },
        "points": chart_points
    }


@router.post("/runs", response_model=QCRunOut)
def record_qc_run(payload: QCRunCreate, db: Session = Depends(get_db)):
    lot = db.query(QCLot).filter(QCLot.id == payload.qc_lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="QC Lot not found")

    recent_runs = db.query(QCRun).filter(
        QCRun.qc_lot_id == lot.id
    ).order_by(QCRun.run_time.desc()).limit(10).all()

    # Evaluate Westgard Rules
    status, rule_violated, z_score = evaluate_westgard_rules(
        target_mean=lot.target_mean,
        target_sd=lot.target_sd,
        current_value=payload.value,
        recent_runs=recent_runs
    )

    run = QCRun(
        qc_lot_id=lot.id,
        run_time=payload.run_time or utc_now(),
        value=payload.value,
        z_score=z_score,
        status=status,
        rule_violated=rule_violated,
        operator=payload.operator or "Manual Entry",
        notes=payload.notes
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run
