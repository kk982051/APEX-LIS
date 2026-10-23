import socket
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from database import get_db
from models import Analyzer, RawPacketLog, Sample, Order, Patient
from schemas import AnalyzerOut, RawPacketLogOut
from analyzer_engine.simulator import (
    generate_astm_cbc_payload,
    generate_astm_3part_payload,
    generate_hl7_chemistry_payload,
    send_astm_tcp_simulated,
    send_hl7_tcp_simulated
)
from analyzer_engine.tcp_listener import process_incoming_analyzer_data, ASTM_PORT, HL7_PORT

router = APIRouter(prefix="/analyzers", tags=["Analyzers"])

def get_host_network_ips():
    """Detects local LAN IPv4 addresses."""
    ips = []
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127."):
                ips.append(ip)
    except Exception:
        pass
    if not ips:
        ips.append("127.0.0.1")
    return ips

def check_port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    """Tests if a TCP port is open and accepting connections."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        result = s.connect_ex((host, port))
        s.close()
        return result == 0
    except Exception:
        return False

@router.get("", response_model=List[AnalyzerOut])
def get_analyzers(db: Session = Depends(get_db)):
    return db.query(Analyzer).all()

@router.get("/network-status")
def get_network_status():
    ips = get_host_network_ips()
    primary_ip = ips[0] if ips else "127.0.0.1"

    # Check local ports
    astm_open = check_port_open("127.0.0.1", ASTM_PORT)
    hl7_open = check_port_open("127.0.0.1", HL7_PORT)
    api_open = check_port_open("127.0.0.1", 8000)

    return {
        "hostname": socket.gethostname(),
        "primary_lan_ip": primary_ip,
        "all_ips": ips,
        "ports": {
            "astm_5100": {"port": ASTM_PORT, "protocol": "ASTM E1394 (Hematology)", "active": astm_open},
            "hl7_5101": {"port": HL7_PORT, "protocol": "HL7 v2.x (Biochemistry)", "active": hl7_open},
            "api_8000": {"port": 8000, "protocol": "FastAPI Core REST & WS", "active": api_open},
            "frontend_3000": {"port": 3000, "protocol": "React Vite Web Workstation", "active": True}
        },
        "connection_urls": {
            "workstation_lan": f"http://{primary_ip}:3000",
            "api_lan": f"http://{primary_ip}:8000/docs",
            "astm_target": f"{primary_ip}:{ASTM_PORT}",
            "hl7_target": f"{primary_ip}:{HL7_PORT}"
        }
    }

@router.get("/raw-logs", response_model=List[RawPacketLogOut])
def get_raw_logs(limit: int = 50, db: Session = Depends(get_db)):
    return db.query(RawPacketLog).order_by(RawPacketLog.id.desc()).limit(limit).all()


@router.post("/simulate/astm")
async def simulate_astm_run(
    barcode: Optional[str] = None,
    species: str = "CANINE",
    abnormal: bool = False,
    analyzer_name: str = "GFE QuickCell Vet",
    use_tcp: bool = True,
    db: Session = Depends(get_db)
):
    """
    Simulates a 5-part CBC Hematology analyzer run (ASTM E1394).
    """
    patient_mrn = "PAT-CAN-001"
    patient_name = "Max"
    breed = "Golden Retriever"

    # Find sample details if barcode supplied
    if barcode:
        sample = db.query(Sample).filter(Sample.barcode == barcode).first()
        if sample and sample.order and sample.order.patient:
            patient_mrn = sample.order.patient.mrn
            patient_name = sample.order.patient.name
            species = sample.order.patient.species
            breed = sample.order.patient.breed
    else:
        # Pick latest pending order or generate barcode
        latest_order = db.query(Order).order_by(Order.id.desc()).first()
        if latest_order and latest_order.samples:
            barcode = latest_order.samples[0].barcode
            patient_mrn = latest_order.patient.mrn
            patient_name = latest_order.patient.name
            species = latest_order.patient.species
            breed = latest_order.patient.breed
        else:
            barcode = f"HEM{datetime.now(timezone.utc).strftime('%H%M%S')}"

    payload_str = generate_astm_cbc_payload(
        barcode=barcode,
        patient_mrn=patient_mrn,
        patient_name=patient_name,
        species=species,
        breed=breed,
        analyzer_name=analyzer_name,
        abnormal=abnormal
    )

    if use_tcp:
        res = await send_astm_tcp_simulated(host="127.0.0.1", port=ASTM_PORT, payload_str=payload_str)
    else:
        res = process_incoming_analyzer_data(payload_str, protocol="ASTM", source_ip="127.0.0.1 (Direct Sim)")

    return {
        "status": "SUCCESS",
        "protocol": "ASTM",
        "analyzer": analyzer_name,
        "barcode": barcode,
        "species": species,
        "abnormal": abnormal,
        "result": res
    }


@router.post("/simulate/astm-3part")
async def simulate_astm_3part_run(
    barcode: Optional[str] = None,
    species: str = "CANINE",
    abnormal: bool = False,
    analyzer_name: str = "Mindray BC-2800 Vet (3-Part)",
    use_tcp: bool = True,
    db: Session = Depends(get_db)
):
    """
    Simulates a 3-part CBC Hematology analyzer run (ASTM E1394).
    Produces: WBC, LYM#, MID#, GRAN#, LYM%, MID%, GRAN%, RBC, HGB, HCT, MCV, MCH, MCHC, RDW, PLT, MPV
    """
    patient_mrn = "PAT-CAN-001"
    patient_name = "Max"
    breed = "Golden Retriever"

    if barcode:
        sample = db.query(Sample).filter(Sample.barcode == barcode).first()
        if sample and sample.order and sample.order.patient:
            patient_mrn = sample.order.patient.mrn
            patient_name = sample.order.patient.name
            species = sample.order.patient.species
            breed = sample.order.patient.breed
    else:
        latest_order = db.query(Order).order_by(Order.id.desc()).first()
        if latest_order and latest_order.samples:
            barcode = latest_order.samples[0].barcode
            patient_mrn = latest_order.patient.mrn
            patient_name = latest_order.patient.name
            species = latest_order.patient.species
            breed = latest_order.patient.breed
        else:
            barcode = f"HEM{datetime.now(timezone.utc).strftime('%H%M%S')}"

    payload_str = generate_astm_3part_payload(
        barcode=barcode,
        patient_mrn=patient_mrn,
        patient_name=patient_name,
        species=species,
        breed=breed,
        analyzer_name=analyzer_name,
        abnormal=abnormal
    )

    if use_tcp:
        res = await send_astm_tcp_simulated(host="127.0.0.1", port=ASTM_PORT, payload_str=payload_str)
    else:
        res = process_incoming_analyzer_data(payload_str, protocol="ASTM", source_ip="127.0.0.1 (Direct 3-Part Sim)")

    return {
        "status": "SUCCESS",
        "protocol": "ASTM",
        "analyzer_type": "3-PART HEMATOLOGY",
        "analyzer": analyzer_name,
        "barcode": barcode,
        "species": species,
        "abnormal": abnormal,
        "result": res
    }


@router.post("/simulate/hl7")
async def simulate_hl7_run(
    barcode: Optional[str] = None,
    species: str = "CANINE",
    abnormal: bool = False,
    analyzer_name: str = "Mindray BS-240",
    use_tcp: bool = True,
    db: Session = Depends(get_db)
):
    """
    Simulates a Clinical Chemistry / Electrolyte analyzer run (HL7 v2.x).
    """
    patient_mrn = "PAT-CAN-001"
    patient_name = "Max"
    breed = "Golden Retriever"

    if barcode:
        sample = db.query(Sample).filter(Sample.barcode == barcode).first()
        if sample and sample.order and sample.order.patient:
            patient_mrn = sample.order.patient.mrn
            patient_name = sample.order.patient.name
            species = sample.order.patient.species
            breed = sample.order.patient.breed
    else:
        latest_order = db.query(Order).order_by(Order.id.desc()).first()
        if latest_order and len(latest_order.samples) > 1:
            barcode = latest_order.samples[1].barcode
            patient_mrn = latest_order.patient.mrn
            patient_name = latest_order.patient.name
            species = latest_order.patient.species
            breed = latest_order.patient.breed
        elif latest_order and latest_order.samples:
            barcode = latest_order.samples[0].barcode
            patient_mrn = latest_order.patient.mrn
            patient_name = latest_order.patient.name
            species = latest_order.patient.species
            breed = latest_order.patient.breed
        else:
            barcode = f"CHM{datetime.now(timezone.utc).strftime('%H%M%S')}"

    payload_str = generate_hl7_chemistry_payload(
        barcode=barcode,
        patient_mrn=patient_mrn,
        patient_name=patient_name,
        species=species,
        breed=breed,
        analyzer_name=analyzer_name,
        abnormal=abnormal
    )

    if use_tcp:
        res = await send_hl7_tcp_simulated(host="127.0.0.1", port=HL7_PORT, payload_str=payload_str)
    else:
        res = process_incoming_analyzer_data(payload_str, protocol="HL7", source_ip="127.0.0.1 (Direct Sim)")

    return {
        "status": "SUCCESS",
        "protocol": "HL7",
        "analyzer": analyzer_name,
        "barcode": barcode,
        "species": species,
        "abnormal": abnormal,
        "result": res
    }
