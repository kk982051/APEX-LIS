"""
HL7 v2.x (ORU^R01 / OML^O21) Parser and ACK Generator for Veterinary Analyzers
Supports MLLP framing (VT / FS / CR) and pipe-and-hat delimiters.
"""
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

VT = b'\x0b'  # Vertical Tab (MLLP Start)
FS = b'\x1c'  # File Separator (MLLP End)
CR = b'\x0d'  # Carriage Return

def wrap_mllp(hl7_message: str) -> bytes:
    """Wraps an HL7 message in standard MLLP envelope: <VT>message<FS><CR>"""
    return VT + hl7_message.encode('latin1') + FS + CR

def unwrap_mllp(data_bytes: bytes) -> str:
    """Strips MLLP wrapper if present and returns string."""
    cleaned = data_bytes.replace(VT, b'').replace(FS, b'')
    return cleaned.decode('latin1', errors='ignore')

def parse_hl7_message(raw_text: str) -> Dict[str, Any]:
    """
    Parses HL7 v2.x message string into structured segments:
    MSH, PID, PV1, OBR, OBX (list)
    """
    lines = [l.strip() for l in raw_text.replace('\r\n', '\r').replace('\n', '\r').split('\r') if l.strip()]

    parsed: Dict[str, Any] = {
        "msh": {},
        "pid": {},
        "obr": {},
        "obx_list": [],
        "raw_segments": lines
    }

    field_sep = '|'
    comp_sep = '^'

    for line in lines:
        if not line:
            continue
        seg_name = line[:3].upper()

        if seg_name == "MSH":
            field_sep = line[3] if len(line) > 3 else '|'
            fields = line.split(field_sep)
            # In MSH, fields[1] is encoding characters (e.g. ^~\&)
            enc_chars = fields[1] if len(fields) > 1 else "^~\\&"
            comp_sep = enc_chars[0] if enc_chars else "^"

            parsed["msh"] = {
                "sending_app": fields[2] if len(fields) > 2 else "Analyzer",
                "sending_facility": fields[3] if len(fields) > 3 else "Lab",
                "receiving_app": fields[4] if len(fields) > 4 else "ApexVetLIS",
                "timestamp": fields[6] if len(fields) > 6 else "",
                "message_type": fields[8] if len(fields) > 8 else "ORU^R01",
                "message_control_id": fields[9] if len(fields) > 9 else "1",
                "processing_id": fields[10] if len(fields) > 10 else "P",
                "version_id": fields[11] if len(fields) > 11 else "2.3.1"
            }

        elif seg_name == "PID":
            fields = line.split(field_sep)
            patient_id = fields[3] if len(fields) > 3 else (fields[2] if len(fields) > 2 else "")
            if comp_sep in patient_id:
                patient_id = patient_id.split(comp_sep)[0]
            
            patient_name = fields[5] if len(fields) > 5 else ""
            sex = fields[8] if len(fields) > 8 else "M"
            
            # Species & breed detection (commonly in PID-35, PID-38, or PID-10 in vet HL7)
            species = ""
            breed = ""
            for idx in [35, 36, 10, 38]:
                if len(fields) > idx and fields[idx]:
                    val = fields[idx]
                    if comp_sep in val:
                        parts = val.split(comp_sep)
                        species = parts[0].strip()
                        if len(parts) > 1:
                            breed = parts[1].strip()
                    else:
                        species = val.strip()
                    if species:
                        break

            parsed["pid"] = {
                "mrn": patient_id.strip(),
                "name": patient_name.replace(comp_sep, ' ').strip(),
                "sex": sex,
                "species": species,
                "breed": breed
            }

        elif seg_name == "OBR":
            fields = line.split(field_sep)
            # OBR-2: Placer Order Number, OBR-3: Filler Order Number (Sample Barcode)
            placer_no = fields[2] if len(fields) > 2 else ""
            filler_no = fields[3] if len(fields) > 3 else ""
            sample_barcode = filler_no if filler_no else placer_no
            if comp_sep in sample_barcode:
                sample_barcode = sample_barcode.split(comp_sep)[0]

            service_id = fields[4] if len(fields) > 4 else ""
            obs_date = fields[7] if len(fields) > 7 else (fields[6] if len(fields) > 6 else "")

            parsed["obr"] = {
                "set_id": fields[1] if len(fields) > 1 else "1",
                "placer_no": placer_no,
                "filler_no": filler_no,
                "sample_barcode": sample_barcode.strip(),
                "service_id": service_id,
                "obs_date": obs_date,
                "specimen_source": fields[15] if len(fields) > 15 else ""
            }

        elif seg_name == "OBX":
            fields = line.split(field_sep)
            # OBX-3: Observation Identifier (e.g. ALT^Alanine Aminotransferase^LN)
            obs_ident = fields[3] if len(fields) > 3 else ""
            parts = obs_ident.split(comp_sep)
            test_code = parts[0].strip()
            test_name = parts[1].strip() if len(parts) > 1 else test_code

            val_str = fields[5] if len(fields) > 5 else ""
            units = fields[6] if len(fields) > 6 else ""
            ref_range = fields[7] if len(fields) > 7 else ""
            abnormal_flags = fields[8] if len(fields) > 8 else "N"
            obs_status = fields[11] if len(fields) > 11 else "F"

            num_val = None
            try:
                num_val = float(val_str)
            except (ValueError, TypeError):
                pass

            parsed["obx_list"].append({
                "set_id": fields[1] if len(fields) > 1 else str(len(parsed["obx_list"]) + 1),
                "value_type": fields[2] if len(fields) > 2 else "NM",
                "test_code": test_code,
                "test_name": test_name,
                "value_str": val_str,
                "value_num": num_val,
                "units": units,
                "reference_range": ref_range,
                "abnormal_flags": abnormal_flags,
                "status": obs_status
            })

    return parsed

def generate_hl7_ack(parsed_msg: Dict[str, Any], ack_code: str = "AA", text_msg: str = "Message accepted") -> str:
    """
    Generates standard HL7 ACK message for a given parsed message.
    """
    msh = parsed_msg.get("msh", {})
    ctrl_id = msh.get("message_control_id", "1")
    sending_app = msh.get("receiving_app", "ApexVetLIS")
    sending_fac = "APEX_LAB"
    recv_app = msh.get("sending_app", "Analyzer")
    recv_fac = msh.get("sending_facility", "Lab")
    
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    ack_ctrl_id = f"ACK_{ctrl_id}_{timestamp[-6:]}"

    ack_msh = f"MSH|^~\\&|{sending_app}|{sending_fac}|{recv_app}|{recv_fac}|{timestamp}||ACK|{ack_ctrl_id}|P|2.3.1\r"
    ack_msa = f"MSA|{ack_code}|{ctrl_id}|{text_msg}\r"
    return ack_msh + ack_msa
