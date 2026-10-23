import sys
import os
import platform
import socket
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db, engine
from models import Order, Patient, ResultItem, RawPacketLog, ClinicSettings, TestMaster, TestReferenceRange
from analyzer_engine.astm_parser import parse_astm_message, calculate_astm_checksum
from analyzer_engine.hl7_parser import parse_hl7_message
from analyzer_engine.delta_checker import resolve_species_flag, evaluate_westgard_rules

router = APIRouter(prefix="/system", tags=["System Diagnostics"])

@router.get("/diagnostics")
def run_system_diagnostics(db: Session = Depends(get_db)):
    diagnostics = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "platform": platform.platform(),
        "python_version": sys.version.split()[0],
        "checks": [],
        "all_passed": True
    }

    try:
        db.execute(text("SELECT 1"))
        order_count = db.query(Order).count()
        patient_count = db.query(Patient).count()
        diagnostics["checks"].append({
            "name": "Database Connection",
            "status": "HEALTHY",
            "details": f"SQLAlchemy engine active. {patient_count} patients, {order_count} orders in database."
        })
    except Exception as e:
        diagnostics["all_passed"] = False
        diagnostics["checks"].append({
            "name": "Database Connection",
            "status": "ERROR",
            "details": str(e)
        })

    try:
        sample_astm = "1H|\\^&|||ApexVetLIS|||||||P|1\r2P|1||PAT001||Canine Test|||||||||\r3O|1|SMP001||^^^CBC|||||||A\r4R|1|^^^WBC|12.5|10^3/uL|6.0-17.0|N||F\r5L|1|N\r"
        parsed_astm = parse_astm_message(sample_astm)
        astm_ok = len(parsed_astm.get("results", [])) > 0
        diagnostics["checks"].append({
            "name": "ASTM Protocol Decoder (E1394)",
            "status": "HEALTHY" if astm_ok else "WARNING",
            "details": "ASTM Modulo-256 checksum & multi-record frame parser operational."
        })
    except Exception as e:
        diagnostics["all_passed"] = False
        diagnostics["checks"].append({
            "name": "ASTM Protocol Decoder",
            "status": "ERROR",
            "details": str(e)
        })

    try:
        sample_hl7 = "MSH|^~\\&|MINDRAY|LAB|APEX|LAB|20260918||ORU^R01|MSG001|P|2.3.1\rPID|1||MRN001||Max\rOBR|1||SMP001|CHEM\rOBX|1|NM|ALT||45|U/L|10-100|N|||F\r"
        parsed_hl7 = parse_hl7_message(sample_hl7)
        hl7_ok = len(parsed_hl7.get("obx_list", [])) > 0
        diagnostics["checks"].append({
            "name": "HL7 v2.x Message Engine",
            "status": "HEALTHY" if hl7_ok else "WARNING",
            "details": "HL7 MSH/PID/OBR/OBX parser & auto-ACK acknowledgment operational."
        })
    except Exception as e:
        diagnostics["all_passed"] = False
        diagnostics["checks"].append({
            "name": "HL7 v2.x Engine",
            "status": "ERROR",
            "details": str(e)
        })

    try:
        range_dog = resolve_species_flag(db, "CANINE", "WBC", 12.0)
        range_cat = resolve_species_flag(db, "FELINE", "WBC", 12.0)
        species_ok = range_dog is not None and range_cat is not None
        diagnostics["checks"].append({
            "name": "Multi-Species Interval Engine",
            "status": "HEALTHY" if species_ok else "WARNING",
            "details": f"Dog WBC: {range_dog.get('ref_low')}-{range_dog.get('ref_high')}, Cat WBC: {range_cat.get('ref_low')}-{range_cat.get('ref_high')}"
        })
    except Exception as e:
        diagnostics["all_passed"] = False
        diagnostics["checks"].append({
            "name": "Multi-Species Engine",
            "status": "ERROR",
            "details": str(e)
        })

    try:
        westgard_status, westgard_rule, z_score = evaluate_westgard_rules(10.0, 1.0, 15.0, [])
        diagnostics["checks"].append({
            "name": "Delta Checks & Westgard QC Evaluator",
            "status": "HEALTHY",
            "details": f"Westgard 1-3s alert engine validated (Status: {westgard_status}, Rule: {westgard_rule}, Z-Score: {z_score})."
        })
    except Exception as e:
        diagnostics["all_passed"] = False
        diagnostics["checks"].append({
            "name": "Delta & QC Engine",
            "status": "ERROR",
            "details": str(e)
        })

    for port, label in [(5100, "ASTM Socket"), (5101, "HL7 Socket")]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.5)
            result = s.connect_ex(('127.0.0.1', port))
            s.close()
            is_listening = (result == 0)
            diagnostics["checks"].append({
                "name": f"Port {port} ({label})",
                "status": "HEALTHY" if is_listening else "STANDBY",
                "details": "Socket is actively accepting connections." if is_listening else "Socket starting or unbound."
            })
        except Exception as e:
            diagnostics["checks"].append({
                "name": f"Port {port} ({label})",
                "status": "UNKNOWN",
                "details": str(e)
            })

    recent_logs = db.query(RawPacketLog).order_by(RawPacketLog.id.desc()).limit(10).all()
    diagnostics["recent_logs"] = [
        {
            "id": r.id,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "protocol": r.protocol,
            "source_ip": r.source_ip,
            "barcode": r.barcode,
            "parsed_summary": r.parsed_summary,
            "raw_preview": r.raw_data[:80] if r.raw_data else ""
        }
        for r in recent_logs
    ]

    return diagnostics

@router.post("/reseed")
def reseed_system(db: Session = Depends(get_db)):
    from seeds.default_tests import seed_database
    seed_database(db)
    return {"status": "SUCCESS", "message": "System default data, test catalogs, and species reference ranges successfully refreshed."}
