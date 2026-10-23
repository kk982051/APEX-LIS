"""
Apex VetLIS Comprehensive Automated Unit and Integration Test Suite
"""
import pytest
from datetime import datetime, date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from models import Patient, Order, Sample, ResultItem, QCLot, QCRun, TestMaster
from seeds.default_tests import seed_database
from analyzer_engine.astm_parser import parse_astm_message, calculate_astm_checksum, build_astm_frame
from analyzer_engine.hl7_parser import parse_hl7_message, generate_hl7_ack, wrap_mllp, unwrap_mllp
from analyzer_engine.delta_checker import resolve_species_flag, compute_delta_check, evaluate_westgard_rules
from analyzer_engine.tcp_listener import process_incoming_analyzer_data
from analyzer_engine.simulator import generate_astm_cbc_payload, generate_hl7_chemistry_payload

# Test DB setup
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_apex_vetlis.db"
test_engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)

client = TestClient(app)

# ==========================================
# 1. ASTM PARSER & FRAMING TESTS
# ==========================================
def test_astm_checksum():
    body = b"1H|\\^&|||QuickCellVet\r\x03"
    cs = calculate_astm_checksum(body)
    assert len(cs) == 2
    assert cs.isalnum()

def test_astm_parsing():
    raw_astm = (
        "H|\\^&|||GFE QuickCell Vet||||||||E1394-97|20260916120000\r"
        "P|1|PAT-CAN-001|||Max|||M|||||CANINE^Golden Retriever\r"
        "O|1|HEM575409||^^^CBC|R|20260916120000|20260916120000||||||||WHOLE_BLOOD\r"
        "R|1|^^^WBC|12.5|10^3/uL|6.0-17.0|N|F|||20260916120000|GFE QuickCell Vet\r"
        "R|2|^^^RBC|6.80|10^6/uL|5.5-8.5|N|F|||20260916120000|GFE QuickCell Vet\r"
        "L|1|N"
    )
    parsed = parse_astm_message(raw_astm)
    assert parsed["header"]["sender_id"] == "GFE QuickCell Vet"
    assert parsed["patient"]["name"] == "Max"
    assert parsed["patient"]["species"] == "CANINE"
    assert parsed["order"]["sample_id"] == "HEM575409"
    assert len(parsed["results"]) == 2
    assert parsed["results"][0]["test_code"] == "WBC"
    assert parsed["results"][0]["value_num"] == 12.5

# ==========================================
# 2. HL7 PARSER & ACK TESTS
# ==========================================
def test_hl7_parsing_and_ack():
    raw_hl7 = (
        "MSH|^~\\&|Mindray BS-240|LAB|ApexVetLIS|HOSP|20260916120000||ORU^R01|MSG001|P|2.3.1\r"
        "PID|1||PAT-CAN-001||Max|||M||||||||||||||||||||||||CANINE^Golden Retriever\r"
        "OBR|1|CHM575410|CHM575410|CHEM_PANEL|||20260916120000\r"
        "OBX|1|NM|ALT^Alanine Aminotransferase^LN||45.0|U/L|10.0-100.0|N|||F\r"
        "OBX|2|NM|CREA^Creatinine^LN||1.1|mg/dL|0.5-1.8|N|||F"
    )
    parsed = parse_hl7_message(raw_hl7)
    assert parsed["msh"]["sending_app"] == "Mindray BS-240"
    assert parsed["obr"]["sample_barcode"] == "CHM575410"
    assert len(parsed["obx_list"]) == 2
    assert parsed["obx_list"][0]["test_code"] == "ALT"
    assert parsed["obx_list"][0]["value_num"] == 45.0

    ack = generate_hl7_ack(parsed)
    assert "MSA|AA|MSG001" in ack

# ==========================================
# 3. SPECIES NORMALIZATION TESTS
# ==========================================
def test_dynamic_species_ranges():
    db = TestingSessionLocal()
    try:
        # For Canine, RBC 6.2 is NORMAL (5.5 - 8.5)
        canine_res = resolve_species_flag(db, species="CANINE", test_code="RBC", value=6.2)
        assert canine_res["flag"] == "NORMAL"

        # For Equine, RBC 6.2 is LOW (Equine normal range is 6.8 - 12.9)
        equine_res = resolve_species_flag(db, species="EQUINE", test_code="RBC", value=6.2)
        assert equine_res["flag"] == "LOW"

        # Critical High test
        crit_res = resolve_species_flag(db, species="CANINE", test_code="WBC", value=35.0)
        assert crit_res["flag"] == "CRITICAL_HIGH"
    finally:
        db.close()

# ==========================================
# 4. DELTA CHECK TESTS
# ==========================================
def test_delta_check_engine():
    db = TestingSessionLocal()
    try:
        # Create Patient with two orders
        p = Patient(mrn="PAT-TEST-DELTA", name="Delta Dog", species="CANINE")
        db.add(p)
        db.flush()

        ord1 = Order(accession_no="ORD-DELTA-1", patient_id=p.id, status="VERIFIED")
        db.add(ord1)
        db.flush()
        res1 = ResultItem(order_id=ord1.id, test_code="CREA", test_name="Creatinine", result_value=1.0, raw_timestamp=datetime(2026, 9, 1, 10, 0))
        db.add(res1)
        db.flush()

        ord2 = Order(accession_no="ORD-DELTA-2", patient_id=p.id, status="PENDING")
        db.add(ord2)
        db.flush()

        # Acute rise: 1.0 -> 2.2 (+120%)
        prev_val, prev_dt, delta_pct, delta_flag = compute_delta_check(db, p.id, ord2.id, "CREA", 2.2)
        assert prev_val == 1.0
        assert delta_pct == 120.0
        assert delta_flag == "SIGNIFICANT"
    finally:
        db.close()

# ==========================================
# 5. WESTGARD QC ENGINE TESTS
# ==========================================
def test_westgard_rules():
    target_mean = 100.0
    target_sd = 5.0

    # 1. Normal run (102.0, z = +0.4) -> PASS
    status, rule, z = evaluate_westgard_rules(target_mean, target_sd, 102.0, recent_runs=[])
    assert status == "PASS"
    assert rule is None

    # 2. 1_2s Warning (111.0, z = +2.2)
    status, rule, z = evaluate_westgard_rules(target_mean, target_sd, 111.0, recent_runs=[])
    assert status == "WARNING"
    assert rule == "1_2s"

    # 3. 1_3s Rejection (116.0, z = +3.2)
    status, rule, z = evaluate_westgard_rules(target_mean, target_sd, 116.0, recent_runs=[])
    assert status == "REJECT"
    assert rule == "1_3s"

    # 4. 2_2s Rejection (two consecutive > +2SD)
    mock_run = QCRun(qc_lot_id=1, value=111.0, z_score=2.2, status="WARNING")
    status, rule, z = evaluate_westgard_rules(target_mean, target_sd, 112.0, recent_runs=[mock_run])
    assert status == "REJECT"
    assert rule == "2_2s"

# ==========================================
# 6. INGESTION PIPELINE & REST API TESTS
# ==========================================
def test_pipeline_ingestion():
    db = TestingSessionLocal()
    try:
        raw_payload = generate_astm_cbc_payload(
            barcode="HEM_AUTO_TEST",
            patient_mrn="PAT-CAN-AUTO",
            patient_name="Buster",
            species="CANINE"
        )
        result = process_incoming_analyzer_data(raw_payload, protocol="ASTM", source_ip="127.0.0.1", db_session=db)
        assert result["status"] == "SUCCESS"
        assert result["barcode"] == "HEM_AUTO_TEST"
        assert result["items_count"] > 0
    finally:
        db.close()

def test_3part_machine_ingestion():
    from analyzer_engine.simulator import generate_astm_3part_payload
    db = TestingSessionLocal()
    try:
        payload_3part = generate_astm_3part_payload(
            barcode="HEM_3PART_TEST",
            patient_mrn="PAT-3P-001",
            patient_name="Charlie",
            species="CANINE",
            analyzer_name="Mindray BC-2800 Vet (3-Part)"
        )
        result = process_incoming_analyzer_data(payload_3part, protocol="ASTM", source_ip="127.0.0.1", db_session=db)
        assert result["status"] == "SUCCESS"
        assert result["barcode"] == "HEM_3PART_TEST"
        assert result["items_count"] >= 15
        
        # Verify 3-part parameters MID% and GRAN% are stored
        res_items = db.query(ResultItem).filter(ResultItem.order_id == result["order_id"]).all()
        codes = [r.test_code for r in res_items]
        assert "MID%" in codes
        assert "GRAN%" in codes
        assert "LYM%" in codes
        assert "MPV" in codes
    finally:
        db.close()

def test_api_patients():
    resp = client.get("/api/patients")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

def test_api_orders_and_verification():
    # 1. Create order
    order_data = {
        "patient": {
            "name": "Bella",
            "species": "FELINE",
            "breed": "Domestic Shorthair",
            "owner_name": "Alice Brown"
        },
        "priority": "ROUTINE",
        "panel_types": ["CBC", "LFT"]
    }
    resp = client.post("/api/orders", json=order_data)
    assert resp.status_code == 200
    ord_json = resp.json()
    order_id = ord_json["id"]
    assert ord_json["status"] == "PENDING"
    assert len(ord_json["samples"]) >= 1

    # 2. Verify order
    v_resp = client.post(f"/api/results/verify/{order_id}", json={
        "verified_by": "Dr. Sarah Taylor, DVM",
        "verification_notes": "Clinical correlation satisfactory."
    })
    assert v_resp.status_code == 200
    assert v_resp.json()["status"] == "SUCCESS"

def test_api_report_summary():
    # Fetch first order
    orders = client.get("/api/orders").json()
    order_id = orders[0]["id"]

    rep_resp = client.get(f"/api/reports/{order_id}/summary")
    assert rep_resp.status_code == 200
    rep_json = rep_resp.json()
    assert "qr_code_base64" in rep_json
    assert rep_json["qr_code_base64"].startswith("data:image/png;base64,")
    assert "verification_hash" in rep_json

def test_api_qc():
    lots = client.get("/api/qc/lots").json()
    assert len(lots) > 0
    lot_id = lots[0]["id"]

    lj = client.get(f"/api/qc/lots/{lot_id}/levey-jennings").json()
    assert "limits" in lj
    assert "statistics" in lj
    assert len(lj["points"]) > 0

def test_api_analyzers_and_network():
    net = client.get("/api/analyzers/network-status").json()
    assert "primary_lan_ip" in net
    assert "ports" in net

def test_auth_login_and_users():
    # 1. Login with correct PIN
    resp = client.post("/api/auth/login", json={"role": "VET", "pin_code": "1234"})
    assert resp.status_code == 200
    user_data = resp.json()["user"]
    assert user_data["role"] == "VET"

    # 2. Login with wrong PIN
    bad_resp = client.post("/api/auth/login", json={"role": "VET", "pin_code": "9999"})
    assert bad_resp.status_code == 401

    # 3. Get all users
    users_resp = client.get("/api/auth/users")
    assert users_resp.status_code == 200
    assert len(users_resp.json()) >= 3

    # 4. Rename user
    vet_user = [u for u in users_resp.json() if u["role"] == "VET"][0]
    update_resp = client.put(f"/api/auth/users/{vet_user['id']}", json={
        "full_name": "Dr. Alexandra Taylor, DVM, PhD, DACVP",
        "title": "Chief of Veterinary Clinical Pathology"
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["user"]["full_name"] == "Dr. Alexandra Taylor, DVM, PhD, DACVP"

def test_clinic_settings_rename():
    # 1. Get settings
    resp = client.get("/api/settings")
    assert resp.status_code == 200
    current_settings = resp.json()
    assert "clinic_name" in current_settings

    # 2. Update clinic name and details
    update_resp = client.put("/api/settings", json={
        "clinic_name": "Apex Central Reference Laboratories & Hospital",
        "address": "450 Science Boulevard, Suite 100",
        "phone": "+1 (800) 999-APEX",
        "email": "contact@apexlabs.com",
        "license_no": "ISO-17025-VET-999"
    })
    assert update_resp.status_code == 200
    updated = update_resp.json()["settings"]
    assert updated["clinic_name"] == "Apex Central Reference Laboratories & Hospital"

    # 3. Verify report reflects the updated clinic name
    orders = client.get("/api/orders").json()
    rep_resp = client.get(f"/api/reports/{orders[0]['id']}/summary")
    assert rep_resp.status_code == 200
    assert rep_resp.json()["clinic"]["clinic_name"] == "Apex Central Reference Laboratories & Hospital"

def test_system_diagnostics_and_reseed():
    # 1. System Diagnostics Check
    diag_resp = client.get("/api/system/diagnostics")
    assert diag_resp.status_code == 200
    diag = diag_resp.json()
    assert "checks" in diag
    assert len(diag["checks"]) >= 5
    assert diag["all_passed"] is True

    # 2. System Reseed Check
    reseed_resp = client.post("/api/system/reseed")
    assert reseed_resp.status_code == 200
    assert reseed_resp.json()["status"] == "SUCCESS"

if __name__ == "__main__":
    pytest.main(["-v", "backend/test_lis_suite.py"])
