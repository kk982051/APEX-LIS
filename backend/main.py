import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base, SessionLocal
from seeds.default_tests import seed_database
from analyzer_engine.tcp_listener import ws_manager, start_tcp_servers
from routers import patients, orders, tests, results, analyzers, qc, reports, auth, settings, system

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ApexVetLIS")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize DB Schema & Seeds
    logger.info("Initializing Apex VetLIS Database schema...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        seed_database(db)
        logger.info("Database successfully seeded with multi-species reference intervals and QC lots.")
    finally:
        db.close()

    # 2. Start TCP Sockets for Analyzers
    astm_server = None
    hl7_server = None
    try:
        astm_server, hl7_server = await start_tcp_servers(host="0.0.0.0", astm_port=5100, hl7_port=5101)
    except Exception as e:
        logger.warning(f"Could not bind TCP sockets on ports 5100/5101 (might be in test environment): {e}")

    yield

    # Shutdown TCP Sockets
    if astm_server:
        astm_server.close()
        await astm_server.wait_closed()
    if hl7_server:
        hl7_server.close()
        await hl7_server.wait_closed()
    logger.info("Apex VetLIS Engine shut down cleanly.")


app = FastAPI(
    title="Apex Veterinary Laboratory Information System (Apex VetLIS)",
    version="2.0.0",
    description="Full-stack Veterinary LIS with Hardware Interfacing (ASTM/HL7), Dynamic Species Normalization, Delta Checks, Westgard QC, and Verification Console.",
    lifespan=lifespan
)

# Enable CORS for local and LAN workstations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(patients.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(tests.router, prefix="/api")
app.include_router(results.router, prefix="/api")
app.include_router(analyzers.router, prefix="/api")
app.include_router(qc.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(system.router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "Apex VetLIS Core Engine",
        "version": "2.0.0",
        "ports": {
            "astm": 5100,
            "hl7": 5101,
            "api": 8000
        }
    }

@app.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial handshake message
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "message": "Connected to Apex VetLIS Real-Time Stream",
            "active_clients": len(ws_manager.active_connections)
        })
        while True:
            # Keep connection open and accept ping/heartbeat
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
