# Apex Veterinary Laboratory Information System (Apex VetLIS) 🐾🔬

A modern, high-performance, full-stack Laboratory Information System (LIS) engineered specifically for veterinary hospitals, reference laboratories, and multi-species clinics.

---

## 🚀 Key System Features

- **Bi-Directional Hardware Interfacing (Dual TCP Sockets)**:
  - **Port 5100 (ASTM E1381 / E1394-97)**: Dedicated socket listener with frame checksum verification and bidirectional handshake (`<ENQ>`, `<ACK>`, `<STX>`, `<ETX>`, `<EOT>`) for 3/5-Part CBC Hematology analyzers (GFE QuickCell Vet, Mindray BC-5000 Vet, Moxa NPort Serial Bridges).
  - **Port 5101 (HL7 v2.x MLLP)**: Dedicated MLLP socket listener with `MSH`, `PID`, `PV1`, `OBR`, `OBX` decoders and automated `MSA|AA` acknowledgment for Biochemistry analyzers (Mindray BS-240, Roche Cobas).
- **Dynamic Veterinary Species Normalization Engine**:
  - Automatically resolves species-specific low/high reference intervals and critical panic thresholds for **Canine**, **Feline**, **Equine**, **Bovine**, and **Avian** patients.
  - Dynamically computes clinical flags: `NORMAL`, `LOW`, `HIGH`, `CRITICAL_LOW`, and `CRITICAL_HIGH`.
- **Automated Historical Delta Check Engine**:
  - Calculates acute physiological shifts vs previous patient visits ($\Delta\% = \frac{\text{Current} - \text{Previous}}{\text{Previous}} \times 100$) to detect rapid clinical deterioration (e.g. Creatinine, Potassium, Hematocrit).
- **Levey-Jennings Quality Control (QC) & Westgard Multi-Rule Evaluator**:
  - Monitors instrument calibration runs against Target Mean ($\mu$) and Standard Deviation ($\sigma$).
  - Evaluates rules: $1_{2s}$ (Warning), $1_{3s}$ (Rejection), $2_{2s}$ (Rejection), $R_{4s}$ (Rejection), $4_{1s}$ (Systematic Shift), and $10_x$ (Systematic Shift).
- **Real-Time Live Telemetry Hub (`/ws/live`)**:
  - Instant WebSocket broadcasting of incoming raw packets, order status changes, and critical flags.
- **Pathologist Verification Workstation**:
  - Side-by-side review console, 5-part WBC differential flow visualizer, manual override audit logging, and **1-Click Batch Approval for 100% Normal Results**.
- **Thermal Barcode Tube Sticker Generator**:
  - Standard 50x25mm (2x1") thermal label rendering with Code-128 barcode for Lavender EDTA, Red Serum, and Grey Fluoride tubes.
- **Official Diagnostic Report Generator**:
  - Clean printable diagnostic laboratory reports with clinic branding, reference intervals, electronic pathologist signature, and cryptographic authenticity QR Code.

---

## 📁 Codebase Structure

```
LIS/
├── start_lis.bat                   # 1-Click Master Launcher (Starts Backend + Frontend)
├── run_backend.bat                 # Backend Launcher
├── run_frontend.bat                # Frontend Launcher
│
├── backend/                        # FastAPI & Socket Server (Python 3.12)
│   ├── main.py                     # App lifespan, CORS, WebSocket endpoint (/ws/live)
│   ├── database.py                 # SQLAlchemy database session & engine
│   ├── models.py                   # DB Entities (Patient, Order, Sample, ResultItem, QC, Analyzer, etc.)
│   ├── schemas.py                  # Pydantic v2 schemas for request validation & serialization
│   ├── test_lis_suite.py           # Automated unit and integration test suite
│   ├── requirements.txt            # Python dependencies
│   │
│   ├── analyzer_engine/            # Hardware Protocols & TCP Listeners
│   │   ├── astm_parser.py          # ASTM E1381 / E1394-97 frame and record decoder
│   │   ├── hl7_parser.py           # HL7 v2.x (ORU^R01 / OML^O21) message decoder & ACK
│   │   ├── tcp_listener.py         # Async TCP Sockets (Port 5100 & 5101) & WS Manager
│   │   ├── delta_checker.py        # Species range resolver, delta check, Westgard evaluator
│   │   └── simulator.py            # Hardware Simulator (QuickCell Vet CBC, Mindray BS-240)
│   │
│   ├── routers/                    # RESTful Endpoints
│   │   ├── patients.py             # Patient CRUD & MRN tracking
│   │   ├── orders.py               # Order lifecycle, specimen draw dates, details editing
│   │   ├── tests.py                # Test catalog & panels (CBC, LFT, KFT, Electrolytes)
│   │   ├── results.py              # Result verification, delta checks, batch approval
│   │   ├── analyzers.py            # Analyzer management, LAN IP detector, simulation triggers
│   │   ├── qc.py                   # Quality Control lots, Levey-Jennings data, Westgard rules
│   │   └── reports.py              # Diagnostic report rendering & authenticity QR codes
│   │
│   └── seeds/
│       └── default_tests.py        # Species-specific ranges (Canine, Feline, Equine, Bovine, Avian)
│
└── frontend/                       # React 18 + Vite + Tailwind CSS
    ├── package.json                # Dependencies (Lucide Icons, Recharts, Axios, etc.)
    ├── vite.config.js              # Network configuration (binds to 0.0.0.0:3000)
    └── src/
        ├── App.jsx                 # Main state coordinator, live WebSocket & notification hub
        └── components/
            ├── Navbar.jsx          # Header with connection pulse, date & quick tools
            ├── Dashboard.jsx       # Real-time metrics, live packet stream, species filters
            ├── OrderEntryModal.jsx # Pet registration (Species, Breed, Microchip, Panels)
            ├── EditOrderModal.jsx  # Date editing (Order, Draw, Verification) & pet info
            ├── VerificationWorkstation.jsx # Pathologist console, 5-part WBC diff, delta checks
            ├── BarcodeModal.jsx    # Thermal barcode sticker printer (EDTA, Serum, Fluoride)
            ├── ReportModal.jsx     # Printable diagnostic report with QR code
            ├── NetworkConfigTab.jsx# LAN/WAN setup hub, IP detector, analyzer wiring guides
            ├── QCLeveyJennings.jsx # Quality Control Levey-Jennings chart & Westgard flags
            └── TestCatalog.jsx     # Multi-species reference interval catalog table
```

---

## 🛠️ Quick Start Instructions

### Option 1: 1-Click Master Launcher (Windows)
Double-click `start_lis.bat` in the root folder. It will:
1. Start the FastAPI Backend & TCP Socket Servers on Port 8000, 5100, 5101.
2. Start the React Vite Web Workstation on Port 3000.
3. Automatically launch your browser to `http://localhost:3000`.

### Option 2: Manual Terminal Execution

#### 1. Start Backend:
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Start Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Running Automated Unit & Integration Tests
```bash
pytest backend/test_lis_suite.py -v
```

---

## 🌐 Network & Port Allocations
- **Web Workstation**: `http://localhost:3000` (LAN: `http://<YOUR_IP>:3000`)
- **Backend API & Swagger Docs**: `http://localhost:8000/docs`
- **ASTM Hematology Socket**: `0.0.0.0:5100`
- **HL7 Biochemistry Socket**: `0.0.0.0:5101`
