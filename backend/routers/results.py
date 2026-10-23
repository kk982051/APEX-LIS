from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from database import get_db
from models import Order, ResultItem, Patient
from schemas import ResultItemOut, ResultItemUpdate, ResultItemCreate, OrderVerify
from analyzer_engine.delta_checker import resolve_species_flag, compute_delta_check
from analyzer_engine.tcp_listener import ws_manager

router = APIRouter(prefix="/results", tags=["Results"])

def utc_now():
    return datetime.now(timezone.utc)

@router.get("/order/{order_id}", response_model=List[ResultItemOut])
def get_order_results(order_id: int, db: Session = Depends(get_db)):
    results = db.query(ResultItem).filter(ResultItem.order_id == order_id).order_by(ResultItem.print_order.asc(), ResultItem.id.asc()).all()
    return results


@router.put("/item/{item_id}", response_model=ResultItemOut)
def update_result_item(item_id: int, payload: ResultItemUpdate, db: Session = Depends(get_db)):
    item = db.query(ResultItem).filter(ResultItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Result item not found")

    order = item.order
    patient_species = order.patient.species if (order and order.patient) else "CANINE"

    if payload.result_value is not None:
        item.result_value = payload.result_value
        item.result_str = str(payload.result_value)
        item.is_manual_override = True
        item.override_reason = payload.override_reason or "Manual pathologist override"

        # Re-evaluate species flag
        spec_info = resolve_species_flag(db, patient_species, item.test_code, payload.result_value)
        item.flag = spec_info["flag"]
        item.ref_low = spec_info["ref_low"]
        item.ref_high = spec_info["ref_high"]

        # Re-compute delta
        pval, pdate, dpct, dflag = compute_delta_check(db, order.patient_id, order.id, item.test_code, payload.result_value)
        item.prev_value = pval
        item.prev_date = pdate
        item.delta_percent = dpct
        item.delta_flag = dflag

    elif payload.result_str is not None:
        item.result_str = payload.result_str
        item.is_manual_override = True
        item.override_reason = payload.override_reason

    db.commit()
    db.refresh(item)
    return item


@router.post("/verify/{order_id}")
async def verify_order(order_id: int, payload: OrderVerify, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = "VERIFIED"
    order.verified_by = payload.verified_by or "Dr. Alex Taylor, DVM, DACVP"
    order.verified_at = utc_now()
    order.verification_notes = payload.verification_notes

    db.commit()

    # Broadcast verification event
    await ws_manager.broadcast({
        "type": "ORDER_VERIFIED",
        "order_id": order.id,
        "accession_no": order.accession_no,
        "patient_name": order.patient.name,
        "verified_by": order.verified_by,
        "timestamp": order.verified_at.isoformat()
    })

    return {
        "status": "SUCCESS",
        "order_id": order.id,
        "accession_no": order.accession_no,
        "verified_by": order.verified_by,
        "verified_at": order.verified_at
    }


@router.post("/batch-approve-normal")
async def batch_approve_normal(db: Session = Depends(get_db)):
    """
    1-Click Batch Approval for all pending/ingested orders where ALL result flags are NORMAL.
    """
    eligible_orders = db.query(Order).filter(
        Order.status.in_(["INGESTED", "PARTIAL"])
    ).all()

    approved_count = 0
    approved_accessions = []

    for ord_obj in eligible_orders:
        results = ord_obj.results
        if not results:
            continue

        # Check if every result flag is NORMAL
        all_normal = all(r.flag == "NORMAL" and (r.delta_flag in ["NORMAL", None]) for r in results)
        if all_normal:
            ord_obj.status = "VERIFIED"
            ord_obj.verified_by = "Auto Batch Approved (All Normal)"
            ord_obj.verified_at = utc_now()
            ord_obj.verification_notes = "Automated batch release: 100% normal parameters within species reference intervals."
            approved_count += 1
            approved_accessions.append(ord_obj.accession_no)

    db.commit()

    if approved_count > 0:
        await ws_manager.broadcast({
            "type": "BATCH_APPROVAL_COMPLETED",
            "count": approved_count,
            "accessions": approved_accessions,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

    return {
        "status": "SUCCESS",
        "approved_count": approved_count,
        "approved_accessions": approved_accessions
    }
