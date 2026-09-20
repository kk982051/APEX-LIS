@echo off
title Apex Veterinary LIS Launcher
color 0A
echo =====================================================================
echo           APEX VETERINARY LABORATORY INFORMATION SYSTEM
echo               Bi-Directional Interfacing & Workstation
echo =====================================================================
echo.
echo Starting Backend API & Hardware TCP Socket Listeners (Ports 5100/5101)...
start "Apex VetLIS - Backend Engine" cmd /k "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting React Frontend Workstation (Port 3000)...
start "Apex VetLIS - Web Workstation" cmd /k "cd frontend && npm run dev"

echo.
echo =====================================================================
echo [OK] Apex VetLIS is starting up!
echo - Web Workstation: http://localhost:3000
echo - REST API / Docs: http://localhost:8000/docs
echo - ASTM TCP Port:   5100 (Hematology Analyzers)
echo - HL7 TCP Port:    5101 (Biochemistry Analyzers)
echo =====================================================================
timeout /t 5
start http://localhost:3000
