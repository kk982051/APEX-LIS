"""
TCP Socket Listeners (ASTM Port 5100, HL7 Port 5101) & Real-Time WebSocket Manager
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Set, Optional
from fastapi import WebSocket
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Order, Sample, ResultItem, Patient, RawPacketLog, Analyzer
from analyzer_engine.astm_parser import parse_astm_message, calculate_astm_checksum, ENQ, ACK, NAK, EOT, STX, ETX, ETB
from analyzer_engine.hl7_parser import parse_hl7_message, generate_hl7_ack, wrap_mllp, unwrap_mllp
from analyzer_engine.delta_checker import resolve_species_flag, compute_delta_check

logger = logging.getLogger("ApexVetLIS.Engine")

# Analyzer socket ports (override via ASTM_PORT / HL7_PORT environment variables)
ASTM_PORT = int(os.getenv("ASTM_PORT", "5100"))
HL7_PORT = int(os.getenv("HL7_PORT", "5101"))

import random
import uuid

def utc_now():
    return datetime.now(timezone.utc)

class WebSocketManager:
    """Manages active WebSocket connections for live telemetry broadcast."""
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        if not self.active_connections:
            return
        payload = json.dumps(message, default=str)
        dead_connections = set()
        for conn in self.active_connections:
            try:
                await conn.send_text(payload)
            except Exception:
                dead_connections.add(conn)
        for dead in dead_connections:
            self.active_connections.discard(dead)

ws_manager = WebSocketManager()


def process_incoming_analyzer_data(raw_data: str, protocol: str, source_ip: str = "127.0.0.1", db_session: Optional[Session] = None) -> Dict[str, Any]:
    """
    Core Ingestion Pipeline:
    1. Logs raw data to database
    2. Decodes ASTM or HL7 structures
    3. Finds or creates matching Order/Sample
    4. Normalizes results against patient species
    5. Computes Delta Checks
    6. Persists ResultItems & Updates Order Status
    7. Schedules live WebSocket broadcast
    """
    own_session = False
    if db_session is None:
        db = SessionLocal()
        own_session = True
    else:
        db = db_session
    try:
        sample_barcode = ""
        analyzer_sender = "Analyzer"
        parsed_results: List[Dict[str, Any]] = []
        patient_mrn = ""
        patient_species = "CANINE"
        patient_name = ""

        if protocol == "ASTM":
            parsed = parse_astm_message(raw_data)
            header = parsed.get("header", {})
            analyzer_sender = header.get("sender_id", "GFE QuickCell Vet")
            order_info = parsed.get("order", {})
            sample_barcode = order_info.get("sample_id", "")
            patient_info = parsed.get("patient", {})
            patient_mrn = patient_info.get("mrn", "")
            patient_name = patient_info.get("name", "")
            if patient_info.get("species"):
                patient_species = patient_info.get("species")
            parsed_results = parsed.get("results", [])

        elif protocol == "HL7":
            parsed = parse_hl7_message(raw_data)
            msh = parsed.get("msh", {})
            analyzer_sender = msh.get("sending_app", "Mindray BS-240")
            obr = parsed.get("obr", {})
            sample_barcode = obr.get("sample_barcode", "")
            pid = parsed.get("pid", {})
            patient_mrn = pid.get("mrn", "")
            patient_name = pid.get("name", "")
            if pid.get("species"):
                patient_species = pid.get("species")
            parsed_results = parsed.get("obx_list", [])

        # 1. Log Raw Packet
        raw_log = RawPacketLog(
            protocol=protocol,
            source_ip=source_ip,
            raw_data=raw_data,
            barcode=sample_barcode,
            parsed_summary=f"{analyzer_sender}: {len(parsed_results)} results received for barcode '{sample_barcode}'",
            timestamp=utc_now()
        )
        db.add(raw_log)
        db.flush()

        # Update analyzer last seen
        analyzer_rec = db.query(Analyzer).filter(Analyzer.name.ilike(f"%{analyzer_sender[:10]}%")).first()
        if analyzer_rec:
            analyzer_rec.last_seen = utc_now()
            analyzer_rec.status = "ONLINE"

        if not sample_barcode and not parsed_results:
            db.commit()
            return {"status": "NO_RESULTS", "log_id": raw_log.id}

        # 2. Match Sample & Order
        sample = None
        order = None
        if sample_barcode:
            sample = db.query(Sample).filter(Sample.barcode == sample_barcode).first()
            if sample:
                order = sample.order

        if not order:
            # Check by accession or create an unassigned/emergency order
            rand_suffix = random.randint(100, 999)
            acc_no = f"ORD-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{rand_suffix}"
            
            # Match patient if MRN exists
            patient = None
            if patient_mrn:
                patient = db.query(Patient).filter(Patient.mrn == patient_mrn).first()

            if not patient:
                # Create emergency patient entry
                pat_mrn = patient_mrn if patient_mrn else f"MRN-{datetime.now(timezone.utc).strftime('%m%d%H%M%S')}-{rand_suffix}"
                patient = Patient(
                    mrn=pat_mrn,
                    name=patient_name if patient_name else f"Emergency Patient ({sample_barcode or 'Direct Run'})",
                    species=patient_species.upper() if patient_species else "CANINE",
                    breed="Unknown",
                    owner_name="Direct Ingestion"
                )
                db.add(patient)
                db.flush()

            order = Order(
                accession_no=acc_no,
                patient_id=patient.id,
                priority="ROUTINE",
                status="INGESTED",
                panel_types="CBC / Chemistry Auto-Ingest",
                clinical_notes="Auto-created from hardware packet ingestion."
            )
            db.add(order)
            db.flush()

            if not sample:
                sample_barcode = sample_barcode if sample_barcode else f"BAR-{datetime.now(timezone.utc).strftime('%H%M%S')}"
                tube = "EDTA_LAVENDER" if protocol == "ASTM" else "SERUM_RED"
                sample = Sample(
                    order_id=order.id,
                    barcode=sample_barcode,
                    tube_type=tube,
                    specimen_type="WHOLE_BLOOD" if protocol == "ASTM" else "SERUM",
                    status="ANALYZED"
                )
                db.add(sample)
                db.flush()
        else:
            patient = order.patient
            if sample:
                sample.status = "ANALYZED"

        # 3. Process Each Result Item
        created_items = []
        patient_species = patient.species.upper() if (patient and patient.species) else "CANINE"

        for r in parsed_results:
            test_code = r.get("test_code", "").upper().strip()
            if not test_code:
                continue

            num_val = r.get("value_num")
            val_str = r.get("value_str", "")

            # Dynamic Species Reference Interval Resolution
            spec_info = resolve_species_flag(
                db=db,
                species=patient_species,
                test_code=test_code,
                value=num_val
            )

            # Historical Delta Check Calculation
            prev_val, prev_dt, delta_pct, delta_flag = compute_delta_check(
                db=db,
                patient_id=order.patient_id,
                current_order_id=order.id,
                test_code=test_code,
                current_value=num_val
            )

            # Check if result item already exists for this order & test_code
            existing_res = db.query(ResultItem).filter(
                ResultItem.order_id == order.id,
                ResultItem.test_code == test_code
            ).first()

            if existing_res:
                existing_res.result_value = num_val
                existing_res.result_str = val_str
                existing_res.unit = spec_info["unit"] or r.get("unit") or r.get("units", "")
                existing_res.ref_low = spec_info["ref_low"]
                existing_res.ref_high = spec_info["ref_high"]
                existing_res.critical_low = spec_info["critical_low"]
                existing_res.critical_high = spec_info["critical_high"]
                existing_res.flag = spec_info["flag"]
                existing_res.prev_value = prev_val
                existing_res.prev_date = prev_dt
                existing_res.delta_percent = delta_pct
                existing_res.delta_flag = delta_flag
                existing_res.analyzer_name = analyzer_sender
                existing_res.raw_timestamp = utc_now()
                created_items.append(existing_res)
            else:
                new_item = ResultItem(
                    order_id=order.id,
                    sample_id=sample.id if sample else None,
                    test_code=test_code,
                    test_name=spec_info["test_name"],
                    category=spec_info["category"],
                    result_value=num_val,
                    result_str=val_str,
                    unit=spec_info["unit"] or r.get("unit") or r.get("units", ""),
                    ref_low=spec_info["ref_low"],
                    ref_high=spec_info["ref_high"],
                    critical_low=spec_info["critical_low"],
                    critical_high=spec_info["critical_high"],
                    flag=spec_info["flag"],
                    prev_value=prev_val,
                    prev_date=prev_dt,
                    delta_percent=delta_pct,
                    delta_flag=delta_flag,
                    analyzer_name=analyzer_sender,
                    raw_timestamp=utc_now()
                )
                db.add(new_item)
                created_items.append(new_item)

        # Update order status to INGESTED
        order.status = "INGESTED"
        db.commit()

        # 4. Asynchronously broadcast via WebSocket
        broadcast_payload = {
            "type": "ANALYZER_PACKET_RECEIVED",
            "protocol": protocol,
            "analyzer": analyzer_sender,
            "barcode": sample_barcode,
            "accession_no": order.accession_no,
            "order_id": order.id,
            "patient_name": patient.name,
            "species": patient.species,
            "result_count": len(created_items),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "raw_snippet": raw_data[:200]
        }

        # Schedule async broadcast task
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(ws_manager.broadcast(broadcast_payload))
        except RuntimeError:
            pass

        return {
            "status": "SUCCESS",
            "order_id": order.id,
            "accession_no": order.accession_no,
            "barcode": sample_barcode,
            "items_count": len(created_items)
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error processing analyzer packet: {e}", exc_info=True)
        return {"status": "ERROR", "error": str(e)}
    finally:
        if own_session:
            db.close()


# --- ASTM TCP Server (Port 5100) ---
def decode_astm_frame(frame_data: bytes) -> Optional[tuple]:
    """
    Validates one ASTM E1381 frame (everything after <STX> up to and including <LF>).
    Returns (frame_number, text) when the checksum matches, otherwise None.
    Text keeps its trailing <CR> for ETX frames, so concatenating the text of
    consecutive frames rebuilds records that were split across ETB frames.
    """
    end_idx = max(frame_data.rfind(ETX), frame_data.rfind(ETB))
    if end_idx < 1 or len(frame_data) < end_idx + 3:
        return None
    body = frame_data[:end_idx + 1]
    received_cs = frame_data[end_idx + 1:end_idx + 3].decode('latin1', errors='ignore').upper()
    if calculate_astm_checksum(body) != received_cs:
        return None
    frame_number = body[:1].decode('latin1', errors='ignore')
    text = body[1:-1].decode('latin1', errors='ignore')
    return frame_number, text


async def handle_astm_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    peer_addr = writer.get_extra_info('peername')
    ip_str = peer_addr[0] if peer_addr else "127.0.0.1"
    logger.info(f"ASTM client connected from {ip_str}")

    buffer: List[str] = []
    last_frame_number = None
    try:
        while True:
            char = await reader.read(1)
            if not char:
                break

            if char == ENQ:
                logger.debug("Received ASTM ENQ -> Sending ACK")
                writer.write(ACK)
                await writer.drain()
                buffer = []
                last_frame_number = None

            elif char == STX:
                # Read until LF (End of Frame), then verify the modulo-256 checksum
                frame_data = await reader.readuntil(b'\n')
                decoded = decode_astm_frame(frame_data)
                if decoded is None:
                    logger.warning(f"ASTM frame checksum mismatch from {ip_str} -> Sending NAK")
                    writer.write(NAK)
                    await writer.drain()
                    continue
                frame_number, text = decoded
                # A repeated frame number means the sender missed our ACK and retransmitted
                if frame_number != last_frame_number:
                    buffer.append(text)
                    last_frame_number = frame_number
                writer.write(ACK)
                await writer.drain()

            elif char == EOT:
                logger.info(f"Received ASTM EOT from {ip_str}. Processing complete message.")
                writer.write(ACK)
                await writer.drain()
                if buffer:
                    raw_msg = "".join(buffer)
                    process_incoming_analyzer_data(raw_msg, protocol="ASTM", source_ip=ip_str)
                    buffer = []
                last_frame_number = None

    except asyncio.IncompleteReadError:
        pass
    except Exception as e:
        logger.error(f"ASTM socket error from {ip_str}: {e}")
    finally:
        if buffer:
            logger.warning(f"ASTM connection from {ip_str} closed before EOT; ingesting {len(buffer)} received frame(s).")
            raw_msg = "".join(buffer)
            process_incoming_analyzer_data(raw_msg, protocol="ASTM", source_ip=ip_str)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        logger.info(f"ASTM client disconnected from {ip_str}")


# --- HL7 TCP Server (Port 5101) ---
MLLP_START = b'\x0b'
MLLP_END = b'\x1c\x0d'

async def handle_hl7_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    peer_addr = writer.get_extra_info('peername')
    ip_str = peer_addr[0] if peer_addr else "127.0.0.1"
    logger.info(f"HL7 client connected from {ip_str}")

    pending = b""
    try:
        while True:
            data = await reader.read(4096)
            if not data:
                break
            pending += data

            # A message may span several reads, and one read may carry several messages
            while MLLP_END in pending:
                frame, pending = pending.split(MLLP_END, 1)
                start = frame.find(MLLP_START)
                if start >= 0:
                    frame = frame[start + 1:]
                raw_str = unwrap_mllp(frame)
                if "MSH" not in raw_str:
                    continue

                parsed = parse_hl7_message(raw_str)
                res = process_incoming_analyzer_data(raw_str, protocol="HL7", source_ip=ip_str)

                if res.get("status") == "ERROR":
                    ack_response = generate_hl7_ack(parsed, ack_code="AE", text_msg="Message could not be processed")
                else:
                    ack_response = generate_hl7_ack(parsed)
                writer.write(wrap_mllp(ack_response))
                await writer.drain()

    except Exception as e:
        logger.error(f"HL7 socket error from {ip_str}: {e}")
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        logger.info(f"HL7 client disconnected from {ip_str}")


async def start_tcp_servers(host: str = "0.0.0.0", astm_port: int = ASTM_PORT, hl7_port: int = HL7_PORT):
    """Starts both ASTM and HL7 background TCP listeners."""
    astm_server = await asyncio.start_server(handle_astm_client, host, astm_port)
    hl7_server = await asyncio.start_server(handle_hl7_client, host, hl7_port)
    logger.info(f"ASTM TCP Listener started on {host}:{astm_port}")
    logger.info(f"HL7 TCP Listener started on {host}:{hl7_port}")
    return astm_server, hl7_server
