#!/bin/bash
set -e

echo "================================================================"
echo "       Apex VetLIS - Google Cloud Run Deployment Wizard"
echo "================================================================"

read -p "Enter your Google Cloud Project ID: " PROJECT_ID
if [ -z "$PROJECT_ID" ]; then
    echo "[ERROR] Project ID cannot be empty."
    exit 1
fi

REGION="us-central1"
SERVICE_NAME="apex-vetlis"

echo "Configuring GCP project: $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

echo "Enabling Cloud APIs (Cloud Run, Cloud Build, Artifact Registry)..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

echo "Building unified container image in Cloud Build..."
gcloud builds submit --tag "gcr.io/$PROJECT_ID/$SERVICE_NAME:latest" .

echo "Deploying container to Google Cloud Run in $REGION..."
gcloud run deploy "$SERVICE_NAME" \
    --image "gcr.io/$PROJECT_ID/$SERVICE_NAME:latest" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1

echo "================================================================"
echo "   Deployment Complete! Your Cloud Run service is LIVE."
echo "================================================================"
