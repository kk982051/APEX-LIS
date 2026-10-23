from datetime import datetime, timedelta, date, timezone
from sqlalchemy.orm import Session
from models import (
    TestMaster, TestReferenceRange, Analyzer, QCLot, QCRun, Patient, Order, Sample, ResultItem,
    User, ClinicSettings
)

# Reference intervals per species
# Format: code: (name, category, default_unit, delta_limit_percent, print_order, {species: (low, high, crit_low, crit_high)})
TEST_DEFINITIONS = {
    # --- Hematology ---
    "WBC": (
        "White Blood Cells", "HEMATOLOGY", "10^3/uL", 25.0, 10,
        {
            "CANINE": (6.0, 17.0, 3.0, 30.0),
            "FELINE": (5.5, 19.5, 2.5, 35.0),
            "EQUINE": (5.4, 14.3, 2.0, 25.0),
            "BOVINE": (4.0, 12.0, 2.0, 22.0),
            "AVIAN": (3.0, 11.0, 1.5, 20.0),
        }
    ),
    "RBC": (
        "Red Blood Cells", "HEMATOLOGY", "10^6/uL", 20.0, 20,
        {
            "CANINE": (5.5, 8.5, 3.0, 11.0),
            "FELINE": (5.0, 10.0, 2.5, 12.5),
            "EQUINE": (6.8, 12.9, 3.5, 15.0),
            "BOVINE": (5.0, 7.5, 2.5, 10.0),
            "AVIAN": (2.0, 4.0, 1.0, 6.0),
        }
    ),
    "HGB": (
        "Hemoglobin", "HEMATOLOGY", "g/dL", 20.0, 30,
        {
            "CANINE": (12.0, 18.0, 7.0, 22.0),
            "FELINE": (8.0, 15.0, 5.0, 18.0),
            "EQUINE": (11.0, 19.0, 6.0, 22.0),
            "BOVINE": (8.0, 15.0, 5.0, 18.0),
            "AVIAN": (7.0, 13.0, 4.0, 16.0),
        }
    ),
    "HCT": (
        "Hematocrit (PCV)", "HEMATOLOGY", "%", 20.0, 40,
        {
            "CANINE": (37.0, 55.0, 20.0, 65.0),
            "FELINE": (24.0, 45.0, 15.0, 55.0),
            "EQUINE": (32.0, 52.0, 18.0, 60.0),
            "BOVINE": (24.0, 46.0, 14.0, 55.0),
            "AVIAN": (35.0, 55.0, 18.0, 65.0),
        }
    ),
    "MCV": (
        "Mean Corpuscular Volume", "HEMATOLOGY", "fL", 15.0, 50,
        {
            "CANINE": (60.0, 77.0, 50.0, 85.0),
            "FELINE": (39.0, 55.0, 30.0, 65.0),
            "EQUINE": (37.0, 58.5, 28.0, 70.0),
            "BOVINE": (40.0, 60.0, 30.0, 70.0),
            "AVIAN": (90.0, 140.0, 70.0, 160.0),
        }
    ),
    "MCH": (
        "Mean Corpuscular Hemoglobin", "HEMATOLOGY", "pg", 15.0, 60,
        {
            "CANINE": (19.5, 24.5, 15.0, 30.0),
            "FELINE": (12.5, 17.5, 9.0, 22.0),
            "EQUINE": (12.3, 19.7, 8.0, 25.0),
            "BOVINE": (11.0, 17.0, 7.0, 22.0),
            "AVIAN": (25.0, 45.0, 18.0, 55.0),
        }
    ),
    "MCHC": (
        "Mean Corpuscular Hgb Conc", "HEMATOLOGY", "g/dL", 15.0, 70,
        {
            "CANINE": (32.0, 36.0, 28.0, 40.0),
            "FELINE": (30.0, 36.0, 26.0, 40.0),
            "EQUINE": (31.0, 37.0, 26.0, 40.0),
            "BOVINE": (30.0, 36.0, 25.0, 40.0),
            "AVIAN": (26.0, 35.0, 20.0, 40.0),
        }
    ),
    "PLT": (
        "Platelet Count", "HEMATOLOGY", "10^3/uL", 30.0, 80,
        {
            "CANINE": (175.0, 500.0, 50.0, 800.0),
            "FELINE": (150.0, 600.0, 40.0, 900.0),
            "EQUINE": (100.0, 350.0, 30.0, 600.0),
            "BOVINE": (100.0, 800.0, 30.0, 1000.0),
            "AVIAN": (20.0, 50.0, 5.0, 90.0),
        }
    ),
    "NEU#": (
        "Neutrophils (Abs)", "HEMATOLOGY", "10^3/uL", 30.0, 90,
        {
            "CANINE": (3.0, 11.5, 1.0, 22.0),
            "FELINE": (2.5, 12.5, 0.8, 25.0),
            "EQUINE": (2.2, 8.5, 0.8, 18.0),
            "BOVINE": (0.6, 4.0, 0.2, 10.0),
            "AVIAN": (1.0, 5.0, 0.3, 12.0),
        }
    ),
    "LYM#": (
        "Lymphocytes (Abs)", "HEMATOLOGY", "10^3/uL", 30.0, 100,
        {
            "CANINE": (1.0, 4.8, 0.3, 10.0),
            "FELINE": (1.5, 7.0, 0.5, 12.0),
            "EQUINE": (1.5, 5.5, 0.5, 10.0),
            "BOVINE": (2.5, 7.5, 1.0, 14.0),
            "AVIAN": (1.5, 6.0, 0.5, 12.0),
        }
    ),
    "MON#": (
        "Monocytes (Abs)", "HEMATOLOGY", "10^3/uL", 40.0, 110,
        {
            "CANINE": (0.1, 1.4, 0.0, 3.0),
            "FELINE": (0.0, 0.9, 0.0, 2.5),
            "EQUINE": (0.0, 1.0, 0.0, 2.5),
            "BOVINE": (0.0, 0.8, 0.0, 2.0),
            "AVIAN": (0.0, 0.5, 0.0, 1.5),
        }
    ),
    "EOS#": (
        "Eosinophils (Abs)", "HEMATOLOGY", "10^3/uL", 40.0, 120,
        {
            "CANINE": (0.1, 1.2, 0.0, 3.5),
            "FELINE": (0.1, 1.5, 0.0, 4.0),
            "EQUINE": (0.0, 1.0, 0.0, 3.0),
            "BOVINE": (0.0, 2.4, 0.0, 5.0),
            "AVIAN": (0.0, 0.3, 0.0, 1.0),
        }
    ),
    "BAS#": (
        "Basophils (Abs)", "HEMATOLOGY", "10^3/uL", 50.0, 130,
        {
            "CANINE": (0.0, 0.2, 0.0, 1.0),
            "FELINE": (0.0, 0.2, 0.0, 1.0),
            "EQUINE": (0.0, 0.3, 0.0, 1.0),
            "BOVINE": (0.0, 0.2, 0.0, 0.8),
            "AVIAN": (0.0, 0.2, 0.0, 0.8),
        }
    ),
    "NEU%": ("Neutrophil %", "HEMATOLOGY", "%", 25.0, 140, {"CANINE": (60.0, 77.0, 30.0, 90.0), "FELINE": (35.0, 75.0, 15.0, 90.0), "EQUINE": (30.0, 65.0, 10.0, 85.0), "BOVINE": (15.0, 45.0, 5.0, 70.0)}),
    "LYM%": ("Lymphocyte %", "HEMATOLOGY", "%", 25.0, 150, {"CANINE": (12.0, 30.0, 5.0, 50.0), "FELINE": (20.0, 55.0, 8.0, 70.0), "EQUINE": (25.0, 60.0, 10.0, 75.0), "BOVINE": (45.0, 75.0, 20.0, 90.0)}),
    "MON%": ("Monocyte %", "HEMATOLOGY", "%", 30.0, 160, {"CANINE": (3.0, 10.0, 0.0, 20.0), "FELINE": (1.0, 4.0, 0.0, 15.0), "EQUINE": (0.0, 7.0, 0.0, 18.0), "BOVINE": (2.0, 7.0, 0.0, 15.0)}),
    "EOS%": ("Eosinophil %", "HEMATOLOGY", "%", 30.0, 170, {"CANINE": (2.0, 10.0, 0.0, 25.0), "FELINE": (2.0, 12.0, 0.0, 30.0), "EQUINE": (0.0, 10.0, 0.0, 25.0), "BOVINE": (0.0, 20.0, 0.0, 35.0)}),
    "BAS%": ("Basophil %", "HEMATOLOGY", "%", 40.0, 180, {"CANINE": (0.0, 1.0, 0.0, 5.0), "FELINE": (0.0, 1.0, 0.0, 5.0), "EQUINE": (0.0, 3.0, 0.0, 6.0), "BOVINE": (0.0, 2.0, 0.0, 5.0)}),
    
    # --- 3-Part Differential Specific Parameters ---
    "MID#": (
        "Mid-Sized Cells (Abs)", "HEMATOLOGY", "10^3/uL", 35.0, 182,
        {
            "CANINE": (0.1, 1.8, 0.0, 4.0),
            "FELINE": (0.1, 1.5, 0.0, 3.5),
            "EQUINE": (0.1, 1.6, 0.0, 3.5),
            "BOVINE": (0.1, 1.5, 0.0, 3.0),
        }
    ),
    "MID%": (
        "Mid-Sized Cells % (3-Part)", "HEMATOLOGY", "%", 30.0, 184,
        {
            "CANINE": (2.0, 12.0, 0.0, 25.0),
            "FELINE": (2.0, 14.0, 0.0, 28.0),
            "EQUINE": (2.0, 12.0, 0.0, 25.0),
            "BOVINE": (2.0, 15.0, 0.0, 30.0),
        }
    ),
    "GRAN#": (
        "Granulocytes (Abs 3-Part)", "HEMATOLOGY", "10^3/uL", 30.0, 186,
        {
            "CANINE": (3.5, 12.0, 1.0, 24.0),
            "FELINE": (3.0, 13.0, 1.0, 26.0),
            "EQUINE": (2.5, 9.0, 1.0, 20.0),
            "BOVINE": (1.0, 5.0, 0.5, 12.0),
        }
    ),
    "GRAN%": (
        "Granulocytes % (3-Part)", "HEMATOLOGY", "%", 25.0, 188,
        {
            "CANINE": (60.0, 80.0, 30.0, 92.0),
            "FELINE": (40.0, 78.0, 20.0, 92.0),
            "EQUINE": (35.0, 70.0, 15.0, 88.0),
            "BOVINE": (20.0, 50.0, 10.0, 75.0),
        }
    ),
    "MPV": (
        "Mean Platelet Volume", "HEMATOLOGY", "fL", 20.0, 190,
        {
            "CANINE": (6.1, 10.1, 4.0, 15.0),
            "FELINE": (8.0, 15.0, 5.0, 20.0),
            "EQUINE": (5.0, 9.5, 3.5, 14.0),
            "BOVINE": (4.5, 8.5, 3.0, 12.0),
        }
    ),
    "RDW": (
        "Red Cell Distribution Width", "HEMATOLOGY", "%", 20.0, 192,
        {
            "CANINE": (12.0, 18.0, 9.0, 25.0),
            "FELINE": (14.0, 20.0, 10.0, 28.0),
            "EQUINE": (14.0, 22.0, 10.0, 30.0),
            "BOVINE": (15.0, 22.0, 10.0, 30.0),
        }
    ),

    # --- Biochemistry & Liver ---
    "ALT": (
        "Alanine Aminotransferase", "BIOCHEMISTRY", "U/L", 30.0, 200,
        {
            "CANINE": (10.0, 100.0, 2.0, 450.0),
            "FELINE": (12.0, 130.0, 2.0, 500.0),
            "EQUINE": (3.0, 25.0, 1.0, 100.0),
            "BOVINE": (11.0, 40.0, 2.0, 120.0),
        }
    ),
    "AST": (
        "Aspartate Aminotransferase", "BIOCHEMISTRY", "U/L", 30.0, 210,
        {
            "CANINE": (0.0, 50.0, 0.0, 250.0),
            "FELINE": (0.0, 48.0, 0.0, 250.0),
            "EQUINE": (150.0, 450.0, 50.0, 1200.0),
            "BOVINE": (40.0, 125.0, 10.0, 400.0),
        }
    ),
    "ALP": (
        "Alkaline Phosphatase", "BIOCHEMISTRY", "U/L", 30.0, 220,
        {
            "CANINE": (23.0, 212.0, 5.0, 800.0),
            "FELINE": (14.0, 111.0, 3.0, 500.0),
            "EQUINE": (70.0, 220.0, 20.0, 700.0),
            "BOVINE": (0.0, 500.0, 0.0, 1200.0),
        }
    ),
    "TBIL": (
        "Total Bilirubin", "BIOCHEMISTRY", "mg/dL", 30.0, 230,
        {
            "CANINE": (0.0, 0.9, 0.0, 4.0),
            "FELINE": (0.0, 0.9, 0.0, 4.0),
            "EQUINE": (0.5, 2.2, 0.0, 6.0),
            "BOVINE": (0.0, 1.6, 0.0, 4.5),
        }
    ),
    "ALB": (
        "Albumin", "BIOCHEMISTRY", "g/dL", 20.0, 240,
        {
            "CANINE": (2.6, 4.0, 1.5, 5.5),
            "FELINE": (2.1, 3.9, 1.4, 5.2),
            "EQUINE": (2.6, 3.7, 1.5, 5.0),
            "BOVINE": (2.1, 3.6, 1.2, 5.0),
        }
    ),
    "TP": (
        "Total Protein", "BIOCHEMISTRY", "g/dL", 15.0, 250,
        {
            "CANINE": (5.2, 8.2, 3.5, 11.0),
            "FELINE": (5.7, 8.9, 3.8, 11.5),
            "EQUINE": (5.2, 7.9, 3.5, 10.5),
            "BOVINE": (5.7, 8.1, 3.5, 10.5),
        }
    ),

    # --- Renal & Kidney ---
    "BUN": (
        "Blood Urea Nitrogen", "BIOCHEMISTRY", "mg/dL", 25.0, 300,
        {
            "CANINE": (7.0, 27.0, 3.0, 80.0),
            "FELINE": (16.0, 36.0, 5.0, 95.0),
            "EQUINE": (10.0, 24.0, 4.0, 65.0),
            "BOVINE": (6.0, 27.0, 2.0, 70.0),
        }
    ),
    "CREA": (
        "Creatinine", "BIOCHEMISTRY", "mg/dL", 25.0, 310,
        {
            "CANINE": (0.5, 1.8, 0.2, 5.0),
            "FELINE": (0.8, 2.4, 0.3, 6.0),
            "EQUINE": (1.2, 1.9, 0.5, 5.0),
            "BOVINE": (1.0, 2.0, 0.4, 5.0),
        }
    ),
    "PHOS": (
        "Phosphorus", "BIOCHEMISTRY", "mg/dL", 25.0, 320,
        {
            "CANINE": (2.5, 6.8, 1.0, 12.0),
            "FELINE": (3.1, 7.5, 1.0, 13.0),
            "EQUINE": (1.5, 4.7, 0.8, 8.0),
            "BOVINE": (5.6, 6.5, 2.0, 10.0),
        }
    ),

    # --- Glucose & Electrolytes ---
    "GLU": (
        "Glucose", "BIOCHEMISTRY", "mg/dL", 25.0, 400,
        {
            "CANINE": (74.0, 143.0, 40.0, 350.0),
            "FELINE": (71.0, 159.0, 40.0, 400.0),
            "EQUINE": (75.0, 115.0, 45.0, 250.0),
            "BOVINE": (40.0, 100.0, 25.0, 200.0),
        }
    ),
    "NA": (
        "Sodium (Na+)", "ELECTROLYTES", "mmol/L", 10.0, 410,
        {
            "CANINE": (144.0, 160.0, 125.0, 175.0),
            "FELINE": (150.0, 165.0, 130.0, 180.0),
            "EQUINE": (132.0, 146.0, 115.0, 165.0),
            "BOVINE": (132.0, 152.0, 115.0, 170.0),
        }
    ),
    "K": (
        "Potassium (K+)", "ELECTROLYTES", "mmol/L", 15.0, 420,
        {
            "CANINE": (3.5, 5.8, 2.5, 7.5),
            "FELINE": (3.5, 5.8, 2.5, 7.5),
            "EQUINE": (2.4, 4.7, 1.8, 6.5),
            "BOVINE": (3.9, 5.8, 2.5, 7.5),
        }
    ),
    "CL": (
        "Chloride (Cl-)", "ELECTROLYTES", "mmol/L", 10.0, 430,
        {
            "CANINE": (109.0, 122.0, 90.0, 135.0),
            "FELINE": (112.0, 129.0, 95.0, 140.0),
            "EQUINE": (99.0, 109.0, 85.0, 125.0),
            "BOVINE": (97.0, 111.0, 80.0, 125.0),
        }
    ),
    "CA": (
        "Calcium (Ca2+)", "ELECTROLYTES", "mg/dL", 15.0, 440,
        {
            "CANINE": (7.9, 12.0, 5.5, 15.0),
            "FELINE": (7.8, 11.3, 5.5, 14.5),
            "EQUINE": (11.2, 13.6, 8.0, 16.5),
            "BOVINE": (9.7, 12.4, 6.5, 15.0),
        }
    ),
}

def seed_database(db: Session):
    # 1. Seed TestMaster and TestReferenceRanges
    for code, (name, category, default_unit, delta_limit, print_order, ranges) in TEST_DEFINITIONS.items():
        tm = db.query(TestMaster).filter(TestMaster.code == code).first()
        if not tm:
            tm = TestMaster(
                code=code,
                name=name,
                category=category,
                default_unit=default_unit,
                delta_limit_percent=delta_limit,
                print_order=print_order
            )
            db.add(tm)
            db.flush()

        for species, (low, high, clow, chigh) in ranges.items():
            ref = db.query(TestReferenceRange).filter(
                TestReferenceRange.test_master_id == tm.id,
                TestReferenceRange.species == species
            ).first()
            if not ref:
                ref = TestReferenceRange(
                    test_master_id=tm.id,
                    species=species,
                    low_val=low,
                    high_val=high,
                    critical_low=clow,
                    critical_high=chigh,
                    unit=default_unit
                )
                db.add(ref)

    # 2. Seed Analyzers
    analyzers = [
        {"name": "GFE QuickCell Vet (5-Part)", "model": "QuickCell Vet 5-Part CBC", "protocol": "ASTM", "ip_address": "192.168.1.50", "port": 5100, "status": "ONLINE", "description": "Hematology 5-Part Laser Differential Analyzer"},
        {"name": "Mindray BC-2800 Vet (3-Part)", "model": "BC-2800 Vet Auto Hematology", "protocol": "ASTM", "ip_address": "192.168.1.54", "port": 5100, "status": "ONLINE", "description": "Veterinary Auto 3-Part Differential Hematology Analyzer (19 Parameters)"},
        {"name": "GFE QuickCell 3-Part Vet", "model": "QuickCell 3-Part CBC", "protocol": "ASTM", "ip_address": "192.168.1.55", "port": 5100, "status": "ONLINE", "description": "Compact 3-Part Veterinary Hematology Analyzer (WBC, LYM, MID, GRAN)"},
        {"name": "Boule Medonic M-Series Vet", "model": "Medonic M32V", "protocol": "ASTM", "ip_address": "192.168.1.56", "port": 5100, "status": "ONLINE", "description": "3-Part Veterinary Hematology Analyzer with Micro-pipette MPA"},
        {"name": "Mindray BC-5000 Vet", "model": "BC-5000 Vet Auto Hematology", "protocol": "ASTM", "ip_address": "192.168.1.52", "port": 5100, "status": "ONLINE", "description": "Automated Veterinary 5-Part Hematology Analyzer"},
        {"name": "Mindray BS-240", "model": "BS-240 Vet Clinical Chemistry", "protocol": "HL7", "ip_address": "192.168.1.51", "port": 5101, "status": "ONLINE", "description": "Automated Chemistry / Electrolyte Analyzer"},
        {"name": "Roche Cobas c111", "model": "Cobas c111", "protocol": "HL7", "ip_address": "192.168.1.53", "port": 5101, "status": "ONLINE", "description": "Benchtop Chemistry Analyzer"},
    ]
    for a in analyzers:
        existing = db.query(Analyzer).filter(Analyzer.name == a["name"]).first()
        if not existing:
            db.add(Analyzer(**a))

    # 3. Seed QC Lots & Historical Runs
    qc_lots_data = [
        {"lot_number": "QC-HEM-2026-N1", "analyzer_name": "GFE QuickCell Vet", "test_code": "WBC", "level": "LEVEL_2_NORMAL", "target_mean": 11.5, "target_sd": 0.6, "expiration_date": date(2026, 12, 31)},
        {"lot_number": "QC-HEM-2026-R1", "analyzer_name": "GFE QuickCell Vet", "test_code": "RBC", "level": "LEVEL_2_NORMAL", "target_mean": 6.8, "target_sd": 0.25, "expiration_date": date(2026, 12, 31)},
        {"lot_number": "QC-CHEM-2026-ALT1", "analyzer_name": "Mindray BS-240", "test_code": "ALT", "level": "LEVEL_2_NORMAL", "target_mean": 45.0, "target_sd": 3.2, "expiration_date": date(2026, 12, 31)},
        {"lot_number": "QC-CHEM-2026-CREA1", "analyzer_name": "Mindray BS-240", "test_code": "CREA", "level": "LEVEL_2_NORMAL", "target_mean": 1.2, "target_sd": 0.08, "expiration_date": date(2026, 12, 31)},
    ]

    for qld in qc_lots_data:
        q_lot = db.query(QCLot).filter(QCLot.lot_number == qld["lot_number"]).first()
        if not q_lot:
            q_lot = QCLot(**qld)
            db.add(q_lot)
            db.flush()

            # Seed 15 historical runs
            base_time = datetime.now(timezone.utc) - timedelta(days=15)
            # Add synthetic normal and 1 slight shift for illustration
            for i in range(15):
                t = base_time + timedelta(days=i, hours=2)
                # slight fluctuation around mean
                noise = ((i * 7) % 5 - 2) * (q_lot.target_sd * 0.4)
                val = round(q_lot.target_mean + noise, 2)
                z = round((val - q_lot.target_mean) / q_lot.target_sd, 2)
                status = "PASS"
                rule = None
                if abs(z) >= 3.0:
                    status = "REJECT"
                    rule = "1_3s"
                elif abs(z) >= 2.0:
                    status = "WARNING"
                    rule = "1_2s"
                db.add(QCRun(
                    qc_lot_id=q_lot.id,
                    run_time=t,
                    value=val,
                    z_score=z,
                    status=status,
                    rule_violated=rule,
                    operator="Auto Interfaced"
                ))

    # 4. Seed Initial Demo Patients & Orders
    demo_patients = [
        {
            "mrn": "PAT-CAN-001", "name": "Max", "species": "CANINE", "breed": "Golden Retriever",
            "age_years": 4.5, "age_months": 6.0, "gender": "MALE_NEUTERED", "microchip_id": "985141002948123",
            "owner_name": "Sarah Jenkins", "owner_phone": "+1 (555) 234-5678", "owner_email": "sarah.j@example.com"
        },
        {
            "mrn": "PAT-FEL-002", "name": "Luna", "species": "FELINE", "breed": "Siamese",
            "age_years": 2.0, "age_months": 3.0, "gender": "FEMALE_SPAYED", "microchip_id": "985141007721394",
            "owner_name": "David Miller", "owner_phone": "+1 (555) 876-5432", "owner_email": "david.m@example.com"
        },
        {
            "mrn": "PAT-EQU-003", "name": "Thunder", "species": "EQUINE", "breed": "Thoroughbred",
            "age_years": 6.0, "age_months": 0.0, "gender": "MALE", "microchip_id": "985141009938472",
            "owner_name": "Oakridge Stables", "owner_phone": "+1 (555) 443-9821", "owner_email": "stables@oakridge.com"
        }
    ]

    for pd in demo_patients:
        p = db.query(Patient).filter(Patient.mrn == pd["mrn"]).first()
        if not p:
            p = Patient(**pd)
            db.add(p)
            db.flush()

            # Create an order with sample
            if p.species == "CANINE":
                ord1 = Order(
                    accession_no="ORD-20260916-001",
                    patient_id=p.id,
                    priority="ROUTINE",
                    status="INGESTED",
                    panel_types="CBC, LFT",
                    clinical_notes="Annual health checkup. Mild lethargy reported."
                )
                db.add(ord1)
                db.flush()

                s1 = Sample(order_id=ord1.id, barcode="HEM575409", tube_type="EDTA_LAVENDER", specimen_type="WHOLE_BLOOD", status="ANALYZED")
                s2 = Sample(order_id=ord1.id, barcode="CHM575410", tube_type="SERUM_RED", specimen_type="SERUM", status="ANALYZED")
                db.add_all([s1, s2])
                db.flush()

                # Add baseline results
                results = [
                    ResultItem(order_id=ord1.id, sample_id=s1.id, test_code="WBC", test_name="White Blood Cells", category="HEMATOLOGY", result_value=12.4, result_str="12.4", unit="10^3/uL", ref_low=6.0, ref_high=17.0, critical_low=3.0, critical_high=30.0, flag="NORMAL", prev_value=11.8, delta_percent=5.1, delta_flag="NORMAL", analyzer_name="GFE QuickCell Vet"),
                    ResultItem(order_id=ord1.id, sample_id=s1.id, test_code="RBC", test_name="Red Blood Cells", category="HEMATOLOGY", result_value=6.85, result_str="6.85", unit="10^6/uL", ref_low=5.5, ref_high=8.5, critical_low=3.0, critical_high=11.0, flag="NORMAL", prev_value=6.70, delta_percent=2.2, delta_flag="NORMAL", analyzer_name="GFE QuickCell Vet"),
                    ResultItem(order_id=ord1.id, sample_id=s1.id, test_code="HGB", test_name="Hemoglobin", category="HEMATOLOGY", result_value=15.2, result_str="15.2", unit="g/dL", ref_low=12.0, ref_high=18.0, critical_low=7.0, critical_high=22.0, flag="NORMAL", prev_value=15.0, delta_percent=1.3, delta_flag="NORMAL", analyzer_name="GFE QuickCell Vet"),
                    ResultItem(order_id=ord1.id, sample_id=s1.id, test_code="HCT", test_name="Hematocrit (PCV)", category="HEMATOLOGY", result_value=46.5, result_str="46.5", unit="%", ref_low=37.0, ref_high=55.0, critical_low=20.0, critical_high=65.0, flag="NORMAL", prev_value=45.0, delta_percent=3.3, delta_flag="NORMAL", analyzer_name="GFE QuickCell Vet"),
                    ResultItem(order_id=ord1.id, sample_id=s1.id, test_code="PLT", test_name="Platelet Count", category="HEMATOLOGY", result_value=320.0, result_str="320", unit="10^3/uL", ref_low=175.0, ref_high=500.0, critical_low=50.0, critical_high=800.0, flag="NORMAL", prev_value=310.0, delta_percent=3.2, delta_flag="NORMAL", analyzer_name="GFE QuickCell Vet"),
                    ResultItem(order_id=ord1.id, sample_id=s1.id, test_code="NEU%", test_name="Neutrophil %", category="HEMATOLOGY", result_value=65.0, result_str="65.0", unit="%", ref_low=60.0, ref_high=77.0, flag="NORMAL", analyzer_name="GFE QuickCell Vet"),
                    ResultItem(order_id=ord1.id, sample_id=s1.id, test_code="LYM%", test_name="Lymphocyte %", category="HEMATOLOGY", result_value=22.0, result_str="22.0", unit="%", ref_low=12.0, ref_high=30.0, flag="NORMAL", analyzer_name="GFE QuickCell Vet"),
                    ResultItem(order_id=ord1.id, sample_id=s1.id, test_code="MON%", test_name="Monocyte %", category="HEMATOLOGY", result_value=6.0, result_str="6.0", unit="%", ref_low=3.0, ref_high=10.0, flag="NORMAL", analyzer_name="GFE QuickCell Vet"),
                    ResultItem(order_id=ord1.id, sample_id=s1.id, test_code="EOS%", test_name="Eosinophil %", category="HEMATOLOGY", result_value=6.0, result_str="6.0", unit="%", ref_low=2.0, ref_high=10.0, flag="NORMAL", analyzer_name="GFE QuickCell Vet"),
                    ResultItem(order_id=ord1.id, sample_id=s1.id, test_code="BAS%", test_name="Basophil %", category="HEMATOLOGY", result_value=1.0, result_str="1.0", unit="%", ref_low=0.0, ref_high=1.0, flag="NORMAL", analyzer_name="GFE QuickCell Vet")
                ]
                db.add_all(results)
                db.flush()

    # 5. Seed Clinic Settings
    settings = db.query(ClinicSettings).first()
    if not settings:
        settings = ClinicSettings(
            clinic_name="Apex Veterinary Reference Laboratory & Diagnostics",
            address="100 Innovation Parkway, Suite 400, BioTech City",
            phone="+1 (800) 555-VET-LIS",
            email="diagnostics@apexvetlab.com",
            license_no="VET-LAB-ISO-17025-2026",
            accreditation="American Association of Veterinary Laboratory Diagnosticians (AAVLD)",
            auto_batch_approve=True
        )
        db.add(settings)

    # 6. Seed Default Users (Admin, Vet, Lab Tech)
    default_users = [
        {
            "username": "admin",
            "full_name": "System Administrator",
            "role": "ADMIN",
            "title": "LIS Operations Director",
            "pin_code": "1234",
            "email": "admin@apexvetlab.com"
        },
        {
            "username": "dr_taylor",
            "full_name": "Dr. Alex Taylor, DVM, DACVP",
            "role": "VET",
            "title": "Board-Certified Veterinary Pathologist",
            "pin_code": "1234",
            "email": "alex.taylor@apexvetlab.com"
        },
        {
            "username": "lab_tech",
            "full_name": "John Doe, MLT (ASCP)",
            "role": "LAB",
            "title": "Senior Veterinary Laboratory Technician",
            "pin_code": "1234",
            "email": "tech.john@apexvetlab.com"
        }
    ]

    for u in default_users:
        existing_u = db.query(User).filter(User.username == u["username"]).first()
        if not existing_u:
            db.add(User(**u))

    db.commit()
