import base64
import io
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
import qrcode

from database import get_db
from models import Order, Patient, ResultItem, Sample, ClinicSettings

router = APIRouter(prefix="/reports", tags=["Reports"])

def generate_qr_code_base64(data: str) -> str:
    """Generates PNG QR code as base64 string."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode('utf-8')}"

@router.get("/{order_id}/summary")
def get_report_summary(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    patient = order.patient
    results = db.query(ResultItem).filter(ResultItem.order_id == order_id).order_by(ResultItem.print_order.asc(), ResultItem.id.asc()).all()
    
    settings = db.query(ClinicSettings).first()
    lab_name = settings.clinic_name if settings else "Apex Veterinary Reference Laboratory & Diagnostics"
    lab_address = settings.address if settings else "100 Innovation Parkway, Suite 400, BioTech City"
    lab_phone = settings.phone if settings else "+1 (800) 555-VET-LIS"
    lab_email = settings.email if settings else "diagnostics@apexvetlab.com"
    lab_license = settings.license_no if settings else "VET-LAB-ISO-17025-2026"
    lab_accreditation = settings.accreditation if settings else "American Association of Veterinary Laboratory Diagnosticians (AAVLD)"

    # Generate cryptographic hash for report authenticity
    result_fingerprint = "|".join(
        f"{r.test_code}={r.result_value if r.result_value is not None else (r.result_str or '')}:{r.flag}"
        for r in results
    )
    verification_hash = hashlib.sha256(
        f"{order.accession_no}_{patient.mrn}_{order.verified_at or ''}_{order.verified_by or ''}_{result_fingerprint}".encode()
    ).hexdigest()[:16].upper()

    # Verification URL / Payload for QR Code
    qr_payload = f"ApexVetLIS://verify?accession={order.accession_no}&mrn={patient.mrn}&hash={verification_hash}&status={order.status}"
    qr_base64 = generate_qr_code_base64(qr_payload)

    # Group results by category
    categories = {}
    for r in results:
        cat = r.category or "OTHER"
        if cat not in categories:
            categories[cat] = []
        categories[cat].append({
            "id": r.id,
            "test_code": r.test_code,
            "test_name": r.test_name,
            "result_value": r.result_value,
            "result_str": r.result_str,
            "unit": r.unit,
            "ref_low": r.ref_low,
            "ref_high": r.ref_high,
            "critical_low": r.critical_low,
            "critical_high": r.critical_high,
            "flag": r.flag,
            "prev_value": r.prev_value,
            "prev_date": r.prev_date.strftime("%Y-%m-%d") if r.prev_date else None,
            "delta_percent": r.delta_percent,
            "delta_flag": r.delta_flag,
            "analyzer_name": r.analyzer_name,
            "is_manual_override": r.is_manual_override,
            "override_reason": r.override_reason
        })

    # Summary statistics
    total_tests = len(results)
    abnormal_tests = sum(1 for r in results if r.flag in ["LOW", "HIGH", "CRITICAL_LOW", "CRITICAL_HIGH"])
    critical_tests = sum(1 for r in results if r.flag in ["CRITICAL_LOW", "CRITICAL_HIGH"])

    return {
        "lab_info": {
            "name": lab_name,
            "address": lab_address,
            "phone": lab_phone,
            "email": lab_email,
            "license": lab_license,
            "accreditation": lab_accreditation
        },
        "clinic": {
            "clinic_name": lab_name,
            "address": lab_address,
            "phone": lab_phone,
            "email": lab_email,
            "license_no": lab_license,
            "accreditation": lab_accreditation
        },
        "order": {
            "id": order.id,
            "accession_no": order.accession_no,
            "order_date": order.order_date.strftime("%Y-%m-%d %H:%M") if order.order_date else None,
            "draw_date": order.draw_date.strftime("%Y-%m-%d %H:%M") if order.draw_date else None,
            "priority": order.priority,
            "status": order.status,
            "panel_types": order.panel_types,
            "clinical_notes": order.clinical_notes,
            "verified_by": order.verified_by or "Pending Pathologist Review",
            "verified_at": order.verified_at.strftime("%Y-%m-%d %H:%M") if order.verified_at else None,
            "verification_notes": order.verification_notes
        },
        "patient": {
            "id": patient.id,
            "mrn": patient.mrn,
            "name": patient.name,
            "species": patient.species,
            "breed": patient.breed,
            "age_years": patient.age_years,
            "age_months": patient.age_months,
            "gender": patient.gender,
            "microchip_id": patient.microchip_id or "N/A",
            "owner_name": patient.owner_name,
            "owner_phone": patient.owner_phone,
            "owner_email": patient.owner_email
        },
        "samples": [
            {
                "id": s.id,
                "barcode": s.barcode,
                "tube_type": s.tube_type,
                "specimen_type": s.specimen_type,
                "draw_date": s.draw_date.strftime("%Y-%m-%d %H:%M") if s.draw_date else None,
                "status": s.status
            }
            for s in order.samples
        ],
        "statistics": {
            "total_tests": total_tests,
            "abnormal_tests": abnormal_tests,
            "critical_tests": critical_tests,
            "is_all_normal": (abnormal_tests == 0 and total_tests > 0)
        },
        "categories": categories,
        "verification_hash": verification_hash,
        "qr_code_base64": qr_base64
    }
