from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    mrn = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    species = Column(String(50), index=True, nullable=False, default="CANINE")
    breed = Column(String(100), default="Mixed Breed")
    age_years = Column(Float, default=1.0)
    age_months = Column(Float, default=0.0)
    gender = Column(String(30), default="MALE")  # MALE, FEMALE, MALE_NEUTERED, FEMALE_SPAYED
    microchip_id = Column(String(100), nullable=True)
    owner_name = Column(String(100), default="Unknown Owner")
    owner_phone = Column(String(50), default="")
    owner_email = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    orders = relationship("Order", back_populates="patient", cascade="all, delete-orphan")


class TestMaster(Base):
    __tablename__ = "test_masters"
    __test__ = False

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)  # e.g. "WBC", "ALT"
    name = Column(String(150), nullable=False)
    category = Column(String(50), default="HEMATOLOGY")  # HEMATOLOGY, BIOCHEMISTRY, ELECTROLYTES, URINALYSIS
    default_unit = Column(String(30), default="")
    delta_limit_percent = Column(Float, default=25.0)
    print_order = Column(Integer, default=100)

    reference_ranges = relationship("TestReferenceRange", back_populates="test_master", cascade="all, delete-orphan")


class TestReferenceRange(Base):
    __tablename__ = "test_reference_ranges"
    __test__ = False

    id = Column(Integer, primary_key=True, index=True)
    test_master_id = Column(Integer, ForeignKey("test_masters.id", ondelete="CASCADE"), nullable=False)
    species = Column(String(50), index=True, nullable=False, default="CANINE")  # CANINE, FELINE, EQUINE, BOVINE, AVIAN, ALL
    low_val = Column(Float, nullable=False)
    high_val = Column(Float, nullable=False)
    critical_low = Column(Float, nullable=True)
    critical_high = Column(Float, nullable=True)
    unit = Column(String(30), default="")

    test_master = relationship("TestMaster", back_populates="reference_ranges")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    accession_no = Column(String(50), unique=True, index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    order_date = Column(DateTime, default=utc_now)
    draw_date = Column(DateTime, default=utc_now)
    clinical_notes = Column(Text, nullable=True)
    priority = Column(String(20), default="ROUTINE")  # ROUTINE, STAT, URGENT
    status = Column(String(30), default="PENDING", index=True)  # PENDING, INGESTED, PARTIAL, VERIFIED, REJECTED
    panel_types = Column(String(200), default="CBC")  # Comma separated e.g. "CBC, LFT, KFT"
    verified_by = Column(String(100), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(Text, nullable=True)

    patient = relationship("Patient", back_populates="orders")
    samples = relationship("Sample", back_populates="order", cascade="all, delete-orphan")
    results = relationship("ResultItem", back_populates="order", cascade="all, delete-orphan")


class Sample(Base):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    barcode = Column(String(60), unique=True, index=True, nullable=False)
    tube_type = Column(String(50), default="EDTA_LAVENDER")  # EDTA_LAVENDER, SERUM_RED, FLUORIDE_GREY, HEPARIN_GREEN
    specimen_type = Column(String(50), default="WHOLE_BLOOD")  # WHOLE_BLOOD, SERUM, PLASMA, URINE
    draw_date = Column(DateTime, default=utc_now)
    status = Column(String(30), default="COLLECTED")  # COLLECTED, PROCESSING, ANALYZED, STORED

    order = relationship("Order", back_populates="samples")
    results = relationship("ResultItem", back_populates="sample")


class ResultItem(Base):
    __tablename__ = "result_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    sample_id = Column(Integer, ForeignKey("samples.id", ondelete="SET NULL"), nullable=True)
    test_code = Column(String(50), index=True, nullable=False)
    test_name = Column(String(150), nullable=False)
    category = Column(String(50), default="HEMATOLOGY")
    result_value = Column(Float, nullable=True)
    result_str = Column(String(100), nullable=True)
    unit = Column(String(30), default="")
    ref_low = Column(Float, nullable=True)
    ref_high = Column(Float, nullable=True)
    critical_low = Column(Float, nullable=True)
    critical_high = Column(Float, nullable=True)
    flag = Column(String(30), default="NORMAL")  # NORMAL, LOW, HIGH, CRITICAL_LOW, CRITICAL_HIGH, UNCHECKED
    prev_value = Column(Float, nullable=True)
    prev_date = Column(DateTime, nullable=True)
    delta_percent = Column(Float, nullable=True)
    delta_flag = Column(String(30), default="NORMAL")  # NORMAL, ALERT, SIGNIFICANT
    analyzer_name = Column(String(100), default="Manual Entry")
    raw_timestamp = Column(DateTime, default=utc_now)
    is_manual_override = Column(Boolean, default=False)
    override_reason = Column(String(255), nullable=True)
    print_order = Column(Integer, default=100)

    order = relationship("Order", back_populates="results")
    sample = relationship("Sample", back_populates="results")


class Analyzer(Base):
    __tablename__ = "analyzers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    model = Column(String(100), nullable=False)
    protocol = Column(String(50), default="ASTM")  # ASTM, HL7, SERIAL_ASTM, SERIAL_HL7
    ip_address = Column(String(50), default="127.0.0.1")
    port = Column(Integer, default=5100)
    status = Column(String(30), default="ONLINE")  # ONLINE, OFFLINE, STANDBY
    last_seen = Column(DateTime, default=utc_now)
    description = Column(String(255), nullable=True)


class QCLot(Base):
    __tablename__ = "qc_lots"

    id = Column(Integer, primary_key=True, index=True)
    lot_number = Column(String(60), unique=True, index=True, nullable=False)
    analyzer_name = Column(String(100), nullable=False)
    test_code = Column(String(50), nullable=False)
    level = Column(String(30), default="LEVEL_2_NORMAL")  # LEVEL_1_LOW, LEVEL_2_NORMAL, LEVEL_3_HIGH
    target_mean = Column(Float, nullable=False)
    target_sd = Column(Float, nullable=False)
    expiration_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)

    runs = relationship("QCRun", back_populates="qc_lot", cascade="all, delete-orphan")


class QCRun(Base):
    __tablename__ = "qc_runs"

    id = Column(Integer, primary_key=True, index=True)
    qc_lot_id = Column(Integer, ForeignKey("qc_lots.id", ondelete="CASCADE"), nullable=False)
    run_time = Column(DateTime, default=utc_now)
    value = Column(Float, nullable=False)
    z_score = Column(Float, nullable=False)
    status = Column(String(30), default="PASS")  # PASS, WARNING, REJECT
    rule_violated = Column(String(50), nullable=True)  # 1_2s, 1_3s, 2_2s, R_4s, 4_1s, 10_x
    notes = Column(Text, nullable=True)
    operator = Column(String(100), default="Auto Interfaced")

    qc_lot = relationship("QCLot", back_populates="runs")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(30), default="VET")  # ADMIN, VET, LAB
    title = Column(String(100), default="Veterinary Clinician")  # e.g. DVM, DACVP, Lead Technician
    pin_code = Column(String(20), default="1234")
    email = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)


class ClinicSettings(Base):
    __tablename__ = "clinic_settings"

    id = Column(Integer, primary_key=True, index=True)
    clinic_name = Column(String(200), default="Apex Veterinary Reference Laboratory & Diagnostics")
    address = Column(String(255), default="100 Innovation Parkway, Suite 400, BioTech City")
    phone = Column(String(50), default="+1 (800) 555-VET-LIS")
    email = Column(String(100), default="diagnostics@apexvetlab.com")
    license_no = Column(String(100), default="VET-LAB-ISO-17025-2026")
    accreditation = Column(String(200), default="American Association of Veterinary Laboratory Diagnosticians (AAVLD)")
    auto_batch_approve = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class RawPacketLog(Base):
    __tablename__ = "raw_packet_logs"

    id = Column(Integer, primary_key=True, index=True)
    protocol = Column(String(30), default="ASTM")  # ASTM, HL7
    source_ip = Column(String(50), default="127.0.0.1")
    raw_data = Column(Text, nullable=False)
    parsed_summary = Column(Text, nullable=True)
    barcode = Column(String(60), nullable=True)
    timestamp = Column(DateTime, default=utc_now)
