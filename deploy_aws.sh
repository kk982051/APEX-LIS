#!/bin/bash
set -e

echo "================================================================"
echo "      Apex VetLIS - AWS Cloud Deployment Wizard (ECR / App Runner)"
echo "================================================================"

read -p "Enter AWS Region [default: us-east-1]: " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}

read -p "Enter your 12-digit AWS Account ID: " AWS_ACCOUNT_ID
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "[ERROR] AWS Account ID is required."
    exit 1
fi

SERVICE_NAME="apex-vetlis"
REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${SERVICE_NAME}"

echo "1. Authenticating Docker with Amazon ECR ($AWS_REGION)..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "2. Creating ECR repository if needed..."
aws ecr create-repository --repository-name "$SERVICE_NAME" --region "$AWS_REGION" 2>/dev/null || true

echo "3. Building Unified Container Image..."
docker build -t "$SERVICE_NAME:latest" .

echo "4. Tagging and Pushing Image to Amazon ECR..."
docker tag "$SERVICE_NAME:latest" "$REPO_URI:latest"
docker push "$REPO_URI:latest"

echo "================================================================"
echo "Image pushed: $REPO_URI:latest"
echo "Deploy on AWS App Runner: https://console.aws.amazon.com/apprunner"
echo "================================================================"
