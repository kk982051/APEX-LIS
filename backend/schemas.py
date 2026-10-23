from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

# --- Patient Schemas ---
class PatientBase(BaseModel):
    mrn: Optional[str] = None
    name: str
    species: str = "CANINE"
    breed: str = "Mixed Breed"
    age_years: float = 1.0
    age_months: float = 0.0
    gender: str = "MALE"
    microchip_id: Optional[str] = None
    owner_name: str = "Unknown Owner"
    owner_phone: str = ""
    owner_email: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class PatientOut(PatientBase):
    id: int
    mrn: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Sample Schemas ---
class SampleBase(BaseModel):
    barcode: str
    tube_type: str = "EDTA_LAVENDER"
    specimen_type: str = "WHOLE_BLOOD"
    draw_date: Optional[datetime] = None
    status: str = "COLLECTED"

class SampleCreate(SampleBase):
    pass

class SampleOut(SampleBase):
    id: int
    order_id: int
    model_config = ConfigDict(from_attributes=True)


# --- Result Item Schemas ---
class ResultItemBase(BaseModel):
    test_code: str
    test_name: str
    category: str = "HEMATOLOGY"
    result_value: Optional[float] = None
    result_str: Optional[str] = None
    unit: Optional[str] = ""
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None
    flag: str = "NORMAL"
    prev_value: Optional[float] = None
    prev_date: Optional[datetime] = None
    delta_percent: Optional[float] = None
    delta_flag: Optional[str] = "NORMAL"
    analyzer_name: Optional[str] = "Manual Entry"
    raw_timestamp: Optional[datetime] = None
    is_manual_override: bool = False
    override_reason: Optional[str] = None
    print_order: int = 100

class ResultItemCreate(ResultItemBase):
    sample_id: Optional[int] = None

class ResultItemUpdate(BaseModel):
    result_value: Optional[float] = None
    result_str: Optional[str] = None
    override_reason: Optional[str] = None

class ResultItemOut(ResultItemBase):
    id: int
    order_id: int
    sample_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


# --- Order Schemas ---
class OrderBase(BaseModel):
    accession_no: Optional[str] = None
    patient_id: int
    order_date: Optional[datetime] = None
    draw_date: Optional[datetime] = None
    clinical_notes: Optional[str] = None
    priority: str = "ROUTINE"
    status: str = "PENDING"
    panel_types: str = "CBC"

class OrderCreate(BaseModel):
    patient_id: Optional[int] = None
    # Inline patient creation if needed
    patient: Optional[PatientCreate] = None
    priority: str = "ROUTINE"
    panel_types: List[str] = ["CBC"]
    clinical_notes: Optional[str] = None
    draw_date: Optional[datetime] = None

class OrderUpdate(BaseModel):
    draw_date: Optional[datetime] = None
    order_date: Optional[datetime] = None
    priority: Optional[str] = None
    clinical_notes: Optional[str] = None
    panel_types: Optional[str] = None
    status: Optional[str] = None

class OrderVerify(BaseModel):
    verified_by: str = "Dr. Alex Taylor, DVM"
    verification_notes: Optional[str] = None

class OrderOut(OrderBase):
    id: int
    accession_no: str
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    patient: PatientOut
    samples: List[SampleOut] = []
    results: List[ResultItemOut] = []
    model_config = ConfigDict(from_attributes=True)


# --- Test Reference Range Schemas ---
class TestReferenceRangeBase(BaseModel):
    species: str
    low_val: float
    high_val: float
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None
    unit: str = ""

class TestReferenceRangeOut(TestReferenceRangeBase):
    id: int
    test_master_id: int
    model_config = ConfigDict(from_attributes=True)

class TestMasterBase(BaseModel):
    code: str
    name: str
    category: str = "HEMATOLOGY"
    default_unit: str = ""
    delta_limit_percent: float = 25.0
    print_order: int = 100

class TestMasterOut(TestMasterBase):
    id: int
    reference_ranges: List[TestReferenceRangeOut] = []
    model_config = ConfigDict(from_attributes=True)


# --- Analyzer Schemas ---
class AnalyzerBase(BaseModel):
    name: str
    model: str
    protocol: str = "ASTM"
    ip_address: str = "127.0.0.1"
    port: int = 5100
    status: str = "ONLINE"
    description: Optional[str] = None

class AnalyzerCreate(AnalyzerBase):
    pass

class AnalyzerOut(AnalyzerBase):
    id: int
    last_seen: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# --- QC Schemas ---
class QCRunBase(BaseModel):
    value: float
    run_time: Optional[datetime] = None
    operator: Optional[str] = "Auto Interfaced"
    notes: Optional[str] = None

class QCRunCreate(QCRunBase):
    qc_lot_id: int

class QCRunOut(QCRunBase):
    id: int
    qc_lot_id: int
    z_score: float
    status: str
    rule_violated: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class QCLotBase(BaseModel):
    lot_number: str
    analyzer_name: str
    test_code: str
    level: str = "LEVEL_2_NORMAL"
    target_mean: float
    target_sd: float
    expiration_date: Optional[date] = None
    is_active: bool = True

class QCLotCreate(QCLotBase):
    pass

class QCLotOut(QCLotBase):
    id: int
    runs: List[QCRunOut] = []
    model_config = ConfigDict(from_attributes=True)


# --- Raw Packet Schemas ---
class RawPacketLogOut(BaseModel):
    id: int
    protocol: str
    source_ip: str
    raw_data: str
    parsed_summary: Optional[str] = None
    barcode: Optional[str] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
