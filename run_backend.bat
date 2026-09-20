@echo off
title Apex VetLIS Backend Engine
color 0B
cd backend
echo Starting Apex VetLIS FastAPI Backend & TCP Sockets (5100/5101)...
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
