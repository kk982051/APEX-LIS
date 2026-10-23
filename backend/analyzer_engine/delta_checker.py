"""
Dynamic Veterinary Reference Range Resolver, Delta Check Engine, and Westgard QC Evaluator
"""
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime
from sqlalchemy.orm import Session
from models import TestMaster, TestReferenceRange, Order, ResultItem, QCLot, QCRun

def resolve_species_flag(
    db: Session,
    species: str,
    test_code: str,
    value: Optional[float]
) -> Dict[str, Any]:
    """
    Looks up species-specific reference ranges and returns:
    ref_low, ref_high, critical_low, critical_high, unit, flag, test_name, category
    """
    if not species:
        species = "CANINE"
    species = species.upper().strip()

    tm = db.query(TestMaster).filter(TestMaster.code == test_code).first()
    test_name = tm.name if tm else test_code
    category = tm.category if tm else "HEMATOLOGY"
    default_unit = tm.default_unit if tm else ""

    if not tm:
        return {
            "test_name": test_name,
            "category": category,
            "ref_low": None,
            "ref_high": None,
            "critical_low": None,
            "critical_high": None,
            "unit": default_unit,
            "flag": "UNCHECKED"
        }

    # Match reference range for this species
    ref_range = db.query(TestReferenceRange).filter(
        TestReferenceRange.test_master_id == tm.id,
        TestReferenceRange.species == species
    ).first()

    # Fallback to ALL or CANINE if specific species not configured
    if not ref_range:
        ref_range = db.query(TestReferenceRange).filter(
            TestReferenceRange.test_master_id == tm.id,
            TestReferenceRange.species.in_(["ALL", "CANINE"])
        ).first()

    if not ref_range:
        return {
            "test_name": test_name,
            "category": category,
            "ref_low": None,
            "ref_high": None,
            "critical_low": None,
            "critical_high": None,
            "unit": default_unit,
            "flag": "UNCHECKED"
        }

    unit = ref_range.unit or default_unit
    low = ref_range.low_val
    high = ref_range.high_val
    clow = ref_range.critical_low
    chigh = ref_range.critical_high

    flag = "NORMAL"
    if value is not None:
        if clow is not None and value <= clow:
            flag = "CRITICAL_LOW"
        elif chigh is not None and value >= chigh:
            flag = "CRITICAL_HIGH"
        elif value < low:
            flag = "LOW"
        elif value > high:
            flag = "HIGH"

    return {
        "test_name": test_name,
        "category": category,
        "ref_low": low,
        "ref_high": high,
        "critical_low": clow,
        "critical_high": chigh,
        "unit": unit,
        "flag": flag
    }


def compute_delta_check(
    db: Session,
    patient_id: int,
    current_order_id: int,
    test_code: str,
    current_value: Optional[float]
) -> Tuple[Optional[float], Optional[datetime], Optional[float], str]:
    """
    Compares current value against the most recent previous result for the same patient.
    Returns: (prev_value, prev_date, delta_percent, delta_flag)
    """
    if current_value is None:
        return None, None, None, "NORMAL"

    # Query last result for this patient & test from a different order
    prev_result = db.query(ResultItem).join(Order).filter(
        Order.patient_id == patient_id,
        Order.id != current_order_id,
        ResultItem.test_code == test_code,
        ResultItem.result_value.isnot(None)
    ).order_by(ResultItem.raw_timestamp.desc(), Order.order_date.desc()).first()

    if not prev_result or prev_result.result_value is None or prev_result.result_value == 0:
        return None, None, None, "NORMAL"

    prev_val = prev_result.result_value
    prev_dt = prev_result.raw_timestamp or prev_result.order.order_date

    delta_abs = current_value - prev_val
    delta_pct = (delta_abs / abs(prev_val)) * 100.0
    delta_pct = round(delta_pct, 1)

    # Get delta threshold from TestMaster
    tm = db.query(TestMaster).filter(TestMaster.code == test_code).first()
    limit_pct = tm.delta_limit_percent if tm and tm.delta_limit_percent else 25.0

    delta_flag = "NORMAL"
    if abs(delta_pct) >= (limit_pct * 2.0):
        delta_flag = "SIGNIFICANT"
    elif abs(delta_pct) >= limit_pct:
        delta_flag = "ALERT"

    return prev_val, prev_dt, delta_pct, delta_flag


def evaluate_westgard_rules(
    target_mean: float,
    target_sd: float,
    current_value: float,
    recent_runs: List[QCRun]
) -> Tuple[str, Optional[str], float]:
    """
    Evaluates Westgard rules for a new QC run.
    Rules:
    1_3s: Value exceeds mean ± 3SD -> REJECT (Random error)
    1_2s: Value exceeds mean ± 2SD -> WARNING (Screening rule)
    2_2s: 2 consecutive runs exceed mean + 2SD or mean - 2SD -> REJECT (Systematic error)
    R_4s: Range between consecutive runs exceeds 4SD -> REJECT (Random error)
    4_1s: 4 consecutive runs exceed mean + 1SD or mean - 1SD -> REJECT (Systematic shift)
    10_x: 10 consecutive runs on one side of mean -> REJECT (Systematic shift)
    
    Returns: (status: PASS|WARNING|REJECT, rule_violated: str|None, z_score: float)
    """
    if target_sd <= 0:
        return "PASS", None, 0.0

    z_current = (current_value - target_mean) / target_sd
    z_rounded = round(z_current, 2)

    # 1_3s check
    if abs(z_current) >= 3.0:
        return "REJECT", "1_3s", z_rounded

    # Check against recent historical runs
    if recent_runs:
        prev_z = recent_runs[0].z_score
        
        # 2_2s check (both > +2SD or both < -2SD)
        if (z_current >= 2.0 and prev_z >= 2.0) or (z_current <= -2.0 and prev_z <= -2.0):
            return "REJECT", "2_2s", z_rounded

        # R_4s check (difference between consecutive runs > 4SD)
        if abs(z_current - prev_z) >= 4.0:
            return "REJECT", "R_4s", z_rounded

    # 4_1s check (last 3 + current = 4 runs)
    if len(recent_runs) >= 3:
        last_3_z = [r.z_score for r in recent_runs[:3]]
        all_4_z = [z_current] + last_3_z
        if all(z >= 1.0 for z in all_4_z) or all(z <= -1.0 for z in all_4_z):
            return "REJECT", "4_1s", z_rounded

    # 10_x check (last 9 + current = 10 runs)
    if len(recent_runs) >= 9:
        last_9_z = [r.z_score for r in recent_runs[:9]]
        all_10_z = [z_current] + last_9_z
        if all(z > 0 for z in all_10_z) or all(z < 0 for z in all_10_z):
            return "REJECT", "10_x", z_rounded

    # 1_2s check (Warning rule)
    if abs(z_current) >= 2.0:
        return "WARNING", "1_2s", z_rounded

    return "PASS", None, z_rounded
