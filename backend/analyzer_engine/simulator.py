"""
Hardware Analyzer Simulator for ASTM E1394 and HL7 v2.x Devices
Simulates: GFE QuickCell Vet (Hematology), Mindray BC-5000 Vet, Mindray BS-240 (Biochemistry)
"""
import asyncio
import socket
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from analyzer_engine.astm_parser import ENQ, ACK, EOT, build_astm_frame
from analyzer_engine.hl7_parser import wrap_mllp
from analyzer_engine.tcp_listener import process_incoming_analyzer_data

def generate_astm_cbc_payload(
    barcode: str = "HEM575409",
    patient_mrn: str = "PAT-CAN-001",
    patient_name: str = "Max",
    species: str = "CANINE",
    breed: str = "Golden Retriever",
    analyzer_name: str = "GFE QuickCell Vet",
    abnormal: bool = False
) -> str:
    """Generates ASTM E1394 formatted string for 5-part CBC hematology run."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    
    # Values
    wbc = 22.4 if abnormal else 11.2
    rbc = 4.2 if abnormal else 6.75
    hgb = 10.1 if abnormal else 15.4
    hct = 31.0 if abnormal else 45.8
    mcv = 68.0
    mch = 22.8
    mchc = 33.6
    plt = 85.0 if abnormal else 295.0
    neu_p = 75.0 if abnormal else 62.0
    lym_p = 15.0 if abnormal else 24.0
    mon_p = 5.0
    eos_p = 4.0
    bas_p = 1.0

    lines = [
        f"H|\\^&|||{analyzer_name}||||||||E1394-97|{ts}",
        f"P|1|{patient_mrn}|||{patient_name}|||M|||||{species}^{breed}",
        f"O|1|{barcode}||^^^CBC|R|{ts}|{ts}||||||||WHOLE_BLOOD",
        f"R|1|^^^WBC|{wbc}|10^3/uL|6.0-17.0|{'H' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|2|^^^RBC|{rbc}|10^6/uL|5.5-8.5|{'L' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|3|^^^HGB|{hgb}|g/dL|12.0-18.0|{'L' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|4|^^^HCT|{hct}|%|37.0-55.0|{'L' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|5|^^^MCV|{mcv}|fL|60.0-77.0|N|F|||{ts}|{analyzer_name}",
        f"R|6|^^^MCH|{mch}|pg|19.5-24.5|N|F|||{ts}|{analyzer_name}",
        f"R|7|^^^MCHC|{mchc}|g/dL|32.0-36.0|N|F|||{ts}|{analyzer_name}",
        f"R|8|^^^PLT|{plt}|10^3/uL|175.0-500.0|{'L' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|9|^^^NEU%|{neu_p}|%|60.0-77.0|N|F|||{ts}|{analyzer_name}",
        f"R|10|^^^LYM%|{lym_p}|%|12.0-30.0|N|F|||{ts}|{analyzer_name}",
        f"R|11|^^^MON%|{mon_p}|%|3.0-10.0|N|F|||{ts}|{analyzer_name}",
        f"R|12|^^^EOS%|{eos_p}|%|2.0-10.0|N|F|||{ts}|{analyzer_name}",
        f"R|13|^^^BAS%|{bas_p}|%|0.0-1.0|N|F|||{ts}|{analyzer_name}",
        "L|1|N"
    ]
    return "\r".join(lines)


def generate_astm_3part_payload(
    barcode: str = "HEM575409",
    patient_mrn: str = "PAT-CAN-001",
    patient_name: str = "Max",
    species: str = "CANINE",
    breed: str = "Golden Retriever",
    analyzer_name: str = "Mindray BC-2800 Vet (3-Part)",
    abnormal: bool = False
) -> str:
    """
    Generates standard ASTM E1394 payload for a 3-Part Differential Hematology Analyzer
    Parameters: WBC, LYM#, MID#, GRAN#, LYM%, MID%, GRAN%, RBC, HGB, HCT, MCV, MCH, MCHC, RDW, PLT, MPV
    """
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

    wbc = 24.5 if abnormal else 10.8
    rbc = 4.10 if abnormal else 6.90
    hgb = 9.8 if abnormal else 15.1
    hct = 29.5 if abnormal else 46.2
    mcv = 67.0
    mch = 21.9
    mchc = 32.7
    rdw = 14.5
    plt = 75.0 if abnormal else 310.0
    mpv = 8.2

    # 3-Part WBC Differential
    lym_pct = 14.0 if abnormal else 22.0
    mid_pct = 6.0 if abnormal else 8.0
    gran_pct = 80.0 if abnormal else 70.0

    lym_abs = round((wbc * (lym_pct / 100.0)), 2)
    mid_abs = round((wbc * (mid_pct / 100.0)), 2)
    gran_abs = round((wbc * (gran_pct / 100.0)), 2)

    lines = [
        f"H|\\^&|||{analyzer_name}||||||||E1394-97|{ts}",
        f"P|1|{patient_mrn}|||{patient_name}|||M|||||{species}^{breed}",
        f"O|1|{barcode}||^^^CBC_3PART|R|{ts}|{ts}||||||||WHOLE_BLOOD",
        f"R|1|^^^WBC|{wbc}|10^3/uL|6.0-17.0|{'H' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|2|^^^LYM%|{lym_pct}|%|12.0-30.0|N|F|||{ts}|{analyzer_name}",
        f"R|3|^^^MID%|{mid_pct}|%|2.0-12.0|N|F|||{ts}|{analyzer_name}",
        f"R|4|^^^GRAN%|{gran_pct}|%|60.0-80.0|{'H' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|5|^^^LYM#|{lym_abs}|10^3/uL|1.0-4.8|N|F|||{ts}|{analyzer_name}",
        f"R|6|^^^MID#|{mid_abs}|10^3/uL|0.1-1.8|N|F|||{ts}|{analyzer_name}",
        f"R|7|^^^GRAN#|{gran_abs}|10^3/uL|3.5-12.0|{'H' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|8|^^^RBC|{rbc}|10^6/uL|5.5-8.5|{'L' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|9|^^^HGB|{hgb}|g/dL|12.0-18.0|{'L' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|10|^^^HCT|{hct}|%|37.0-55.0|{'L' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|11|^^^MCV|{mcv}|fL|60.0-77.0|N|F|||{ts}|{analyzer_name}",
        f"R|12|^^^MCH|{mch}|pg|19.5-24.5|N|F|||{ts}|{analyzer_name}",
        f"R|13|^^^MCHC|{mchc}|g/dL|32.0-36.0|N|F|||{ts}|{analyzer_name}",
        f"R|14|^^^RDW|{rdw}|%|12.0-18.0|N|F|||{ts}|{analyzer_name}",
        f"R|15|^^^PLT|{plt}|10^3/uL|175.0-500.0|{'L' if abnormal else 'N'}|F|||{ts}|{analyzer_name}",
        f"R|16|^^^MPV|{mpv}|fL|6.1-10.1|N|F|||{ts}|{analyzer_name}",
        "L|1|N"
    ]
    return "\r".join(lines)


def generate_hl7_chemistry_payload(
    barcode: str = "CHM575410",
    patient_mrn: str = "PAT-CAN-001",
    patient_name: str = "Max",
    species: str = "CANINE",
    breed: str = "Golden Retriever",
    analyzer_name: str = "Mindray BS-240",
    abnormal: bool = False
) -> str:
    """Generates HL7 v2.3.1 ORU^R01 message for Clinical Chemistry."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    ctrl_id = f"MSG_{datetime.now(timezone.utc).strftime('%H%M%S%f')[:10]}"

    alt = 185.0 if abnormal else 38.0
    ast = 92.0 if abnormal else 24.0
    alp = 340.0 if abnormal else 85.0
    alb = 3.2
    tp = 6.8
    bun = 42.0 if abnormal else 14.5
    crea = 2.9 if abnormal else 0.95
    glu = 110.0
    na = 148.0
    k = 4.4
    cl = 114.0

    lines = [
        f"MSH|^~\\&|{analyzer_name}|LAB_CORE|ApexVetLIS|VET_HOSPITAL|{ts}||ORU^R01|{ctrl_id}|P|2.3.1",
        f"PID|1||{patient_mrn}||{patient_name}|||M||||||||||||||||||||||||{species}^{breed}",
        f"PV1|1|O",
        f"OBR|1|{barcode}|{barcode}|CHEM_PANEL^Comprehensive Chemistry|||{ts}||||||||SERUM",
        f"OBX|1|NM|ALT^Alanine Aminotransferase^LN||{alt}|U/L|10.0-100.0|{'H' if abnormal else 'N'}|||F",
        f"OBX|2|NM|AST^Aspartate Aminotransferase^LN||{ast}|U/L|0.0-50.0|{'H' if abnormal else 'N'}|||F",
        f"OBX|3|NM|ALP^Alkaline Phosphatase^LN||{alp}|U/L|23.0-212.0|{'H' if abnormal else 'N'}|||F",
        f"OBX|4|NM|ALB^Albumin^LN||{alb}|g/dL|2.6-4.0|N|||F",
        f"OBX|5|NM|TP^Total Protein^LN||{tp}|g/dL|5.2-8.2|N|||F",
        f"OBX|6|NM|BUN^Blood Urea Nitrogen^LN||{bun}|mg/dL|7.0-27.0|{'H' if abnormal else 'N'}|||F",
        f"OBX|7|NM|CREA^Creatinine^LN||{crea}|mg/dL|0.5-1.8|{'H' if abnormal else 'N'}|||F",
        f"OBX|8|NM|GLU^Glucose^LN||{glu}|mg/dL|74.0-143.0|N|||F",
        f"OBX|9|NM|NA^Sodium^LN||{na}|mmol/L|144.0-160.0|N|||F",
        f"OBX|10|NM|K^Potassium^LN||{k}|mmol/L|3.5-5.8|N|||F",
        f"OBX|11|NM|CL^Chloride^LN||{cl}|mmol/L|109.0-122.0|N|||F",
    ]
    return "\r".join(lines)


async def send_astm_tcp_simulated(host: str = "127.0.0.1", port: int = 5100, payload_str: str = ""):
    """Connects to Port 5100 over TCP and sends ASTM frames with handshake."""
    try:
        reader, writer = await asyncio.open_connection(host, port)
        # 1. Send ENQ
        writer.write(ENQ)
        await writer.drain()
        ack = await reader.read(1)

        # 2. Send frames
        lines = payload_str.split('\r')
        for i, line in enumerate(lines, 1):
            frame = build_astm_frame(i, line, is_last_frame=(i == len(lines)))
            writer.write(frame)
            await writer.drain()
            ack = await reader.read(1)

        # 3. Send EOT
        writer.write(EOT)
        await writer.drain()
        ack = await reader.read(1)

        writer.close()
        await writer.wait_closed()
        return {"status": "SUCCESS", "message": "ASTM simulation sent over TCP"}
    except Exception as e:
        # Fallback to direct pipeline if port is busy/unavailable
        res = process_incoming_analyzer_data(payload_str, protocol="ASTM", source_ip="127.0.0.1 (Direct Sim)")
        return {"status": "DIRECT_SUCCESS", "details": res, "socket_note": str(e)}


async def send_hl7_tcp_simulated(host: str = "127.0.0.1", port: int = 5101, payload_str: str = ""):
    """Connects to Port 5101 over TCP and sends MLLP-wrapped HL7 message."""
    try:
        reader, writer = await asyncio.open_connection(host, port)
        mllp_data = wrap_mllp(payload_str)
        writer.write(mllp_data)
        await writer.drain()
        ack = await reader.read(4096)
        writer.close()
        await writer.wait_closed()
        return {"status": "SUCCESS", "message": "HL7 simulation sent over TCP", "ack": ack.decode('latin1', errors='ignore')}
    except Exception as e:
        res = process_incoming_analyzer_data(payload_str, protocol="HL7", source_ip="127.0.0.1 (Direct Sim)")
        return {"status": "DIRECT_SUCCESS", "details": res, "socket_note": str(e)}
