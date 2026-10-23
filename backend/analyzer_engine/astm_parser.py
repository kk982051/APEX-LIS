"""
ASTM E1381 / ASTM E1394-97 Protocol Parser & Frame Builder
Standard for transferring information between clinical laboratory instruments and computer systems.
"""
import re
from typing import Dict, Any, List, Optional

# ASTM Control Characters
STX = b'\x02'  # Start of Text
ETX = b'\x03'  # End of Text
ETB = b'\x17'  # End of Transmission Block
EOT = b'\x04'  # End of Transmission
ENQ = b'\x05'  # Enquiry
ACK = b'\x06'  # Acknowledge
NAK = b'\x15'  # Negative Acknowledge
CR  = b'\x0d'  # Carriage Return
LF  = b'\x0a'  # Line Feed

def calculate_astm_checksum(data_bytes: bytes) -> str:
    """
    Computes ASTM modulo-256 checksum formatted as 2 uppercase hex characters.
    The checksum is calculated on characters from STX+1 up to and including ETX or ETB.
    """
    total = sum(data_bytes) % 256
    return f"{total:02X}"

def build_astm_frame(frame_number: int, record_str: str, is_last_frame: bool = True) -> bytes:
    """
    Encapsulates a record string into an ASTM E1381 frame:
    <STX>[FrameNumber][RecordText]<CR>[ETX or ETB][Checksum]<CR><LF>
    """
    end_char = ETX if is_last_frame else ETB
    frame_body = f"{frame_number % 8}{record_str}".encode('latin1') + CR + end_char
    cs = calculate_astm_checksum(frame_body)
    return STX + frame_body + cs.encode('latin1') + CR + LF

def parse_astm_message(raw_text: str) -> Dict[str, Any]:
    """
    Parses a multi-line ASTM E1394 message string into structured records.
    Lines typically start with:
    H (Header), P (Patient), O (Order), R (Result), C (Comment), L (Terminator)
    """
    lines = [line.strip() for line in raw_text.replace('\r\n', '\r').replace('\n', '\r').split('\r') if line.strip()]
    
    # Strip frame headers/footers if present in line (e.g. \x021H|... \x033A)
    clean_lines = []
    for line in lines:
        cleaned = re.sub(r'^[\x02\d]+', '', line)
        cleaned = re.sub(r'[\x03\x17][0-9A-Fa-f]{2}$', '', cleaned)
        if cleaned:
            clean_lines.append(cleaned)

    delimiter = '|'
    sub_delimiter = '^'

    parsed: Dict[str, Any] = {
        "header": {},
        "patient": {},
        "order": {},
        "results": [],
        "comments": [],
        "raw_lines": clean_lines
    }

    for line in clean_lines:
        if not line:
            continue
        rec_type = line[0].upper()
        fields = line.split(delimiter)

        if rec_type == 'H':
            # Header: H|\^&|||AnalyzerName||||||||Version|DateTime
            delims = fields[1] if len(fields) > 1 else r"\^&"
            parsed["header"] = {
                "record_type": "H",
                "delimiters": delims,
                "sender_id": fields[4] if len(fields) > 4 else "Analyzer",
                "version": fields[12] if len(fields) > 12 else "",
                "timestamp": fields[13] if len(fields) > 13 else ""
            }
        elif rec_type == 'P':
            # Patient: P|Seq|MRN|||LastName^FirstName||DOB|Sex|||||Species^Breed
            species = ""
            breed = ""
            if len(fields) > 13 and fields[13]:
                sp_parts = fields[13].split(sub_delimiter)
                species = sp_parts[0].strip()
                if len(sp_parts) > 1:
                    breed = sp_parts[1].strip()
            
            parsed["patient"] = {
                "record_type": "P",
                "seq": fields[1] if len(fields) > 1 else "1",
                "mrn": fields[2] if len(fields) > 2 else (fields[3] if len(fields) > 3 else ""),
                "name": fields[5] if len(fields) > 5 else "",
                "sex": fields[8] if len(fields) > 8 else "",
                "species": species,
                "breed": breed
            }
        elif rec_type == 'O':
            # Order: O|Seq|SampleID||^^^UniversalTestID|Priority|OrderDate|DrawDate||||||||SpecimenType
            sample_id = fields[2] if len(fields) > 2 else ""
            test_id = fields[4] if len(fields) > 4 else ""
            if "^^^" in test_id:
                test_id = test_id.split("^^^")[-1]
            elif "^" in test_id:
                test_id = test_id.split("^")[0]

            parsed["order"] = {
                "record_type": "O",
                "seq": fields[1] if len(fields) > 1 else "1",
                "sample_id": sample_id.strip(),
                "test_id": test_id.strip(),
                "priority": fields[5] if len(fields) > 5 else "R",
                "order_date": fields[6] if len(fields) > 6 else "",
                "draw_date": fields[7] if len(fields) > 7 else "",
                "specimen_type": fields[15] if len(fields) > 15 else "WHOLE_BLOOD"
            }
        elif rec_type == 'R':
            # Result: R|Seq|^^^TestCode|Value|Unit|RefRange|Flag|Status||Operator|DateTime|Instrument
            raw_code = fields[2] if len(fields) > 2 else ""
            code_parts = raw_code.split("^")
            test_code = code_parts[3] if len(code_parts) > 3 and code_parts[3] else (code_parts[0] if code_parts[0] else raw_code)
            test_code = test_code.strip()

            val_str = fields[3] if len(fields) > 3 else ""
            unit_str = fields[4] if len(fields) > 4 else ""
            ref_str = fields[5] if len(fields) > 5 else ""
            flag_str = fields[6] if len(fields) > 6 else "N"
            status_str = fields[7] if len(fields) > 7 else "F"
            inst_str = fields[11] if len(fields) > 11 else ""

            # Try numeric parse
            num_val = None
            try:
                num_val = float(val_str)
            except (ValueError, TypeError):
                pass

            parsed["results"].append({
                "record_type": "R",
                "seq": fields[1] if len(fields) > 1 else str(len(parsed["results"]) + 1),
                "test_code": test_code,
                "value_str": val_str,
                "value_num": num_val,
                "unit": unit_str,
                "reference_range": ref_str,
                "flag": flag_str,
                "status": status_str,
                "instrument": inst_str
            })
        elif rec_type == 'C':
            parsed["comments"].append(fields[3] if len(fields) > 3 else line)

    return parsed
