@echo off
title Deploy Apex VetLIS to Google Cloud Run
color 0B
echo ================================================================
echo        Apex VetLIS - Google Cloud Run Deployment Wizard
echo ================================================================
echo.

set /p PROJECT_ID="Enter your Google Cloud Project ID: "
if "%PROJECT_ID%"=="" (
    echo [ERROR] Project ID cannot be empty.
    pause
    exit /b 1
)

set REGION=us-central1
set SERVICE_NAME=apex-vetlis

echo.
echo Setting GCP project to: %PROJECT_ID%...
call gcloud config set project %PROJECT_ID%

echo.
echo Enabling required Google Cloud APIs (Cloud Run, Cloud Build, Artifact Registry)...
call gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

echo.
echo Submitting Multi-Stage Build to Google Cloud Build (Builds React + FastAPI in Cloud)...
call gcloud builds submit --tag gcr.io/%PROJECT_ID%/%SERVICE_NAME%:latest .

echo.
echo Deploying %SERVICE_NAME% container to Cloud Run in %REGION%...
call gcloud run deploy %SERVICE_NAME% ^
    --image gcr.io/%PROJECT_ID%/%SERVICE_NAME%:latest ^
    --region %REGION% ^
    --platform managed ^
    --allow-unauthenticated ^
    --port 8080 ^
    --memory 1Gi ^
    --cpu 1

echo.
echo ================================================================
echo    Deployment Completed! Your Cloud Run service is LIVE.
echo ================================================================
pause
