@echo off
title Deploy Apex VetLIS to AWS (Amazon ECR + AWS App Runner / ECS)
color 0A
echo ================================================================
echo       Apex VetLIS - AWS Cloud Deployment Wizard (ECR / App Runner)
echo ================================================================
echo.

set /p AWS_REGION="Enter AWS Region [e.g. us-east-1]: "
if "%AWS_REGION%"=="" set AWS_REGION=us-east-1

set /p AWS_ACCOUNT_ID="Enter your 12-digit AWS Account ID: "
if "%AWS_ACCOUNT_ID%"=="" (
    echo [ERROR] AWS Account ID is required.
    pause
    exit /b 1
)

set SERVICE_NAME=apex-vetlis
set REPO_URI=%AWS_ACCOUNT_ID%.dkr.ecr.%AWS_REGION%.amazonaws.com/%SERVICE_NAME%

echo.
echo 1. Authenticating Docker with Amazon ECR (%AWS_REGION%)...
aws ecr get-login-password --region %AWS_REGION% | docker login --username AWS --password-stdin %AWS_ACCOUNT_ID%.dkr.ecr.%AWS_REGION%.amazonaws.com

echo.
echo 2. Creating ECR repository if it does not exist...
aws ecr create-repository --repository-name %SERVICE_NAME% --region %AWS_REGION% 2>nul

echo.
echo 3. Building Unified Multi-Stage Production Container (React + FastAPI)...
docker build -t %SERVICE_NAME%:latest .

echo.
echo 4. Tagging and Pushing Image to Amazon ECR...
docker tag %SERVICE_NAME%:latest %REPO_URI%:latest
docker push %REPO_URI%:latest

echo.
echo 5. Image successfully pushed to Amazon ECR: %REPO_URI%:latest
echo.
echo ================================================================
echo NEXT STEPS IN AWS CONSOLE:
echo 1. Open AWS App Runner: https://console.aws.amazon.com/apprunner
echo 2. Click 'Create service' - Source: 'Container registry' - 'Amazon ECR'
echo 3. Select container image: %REPO_URI%:latest
echo 4. Port: 8080 - Deployment trigger: Automatic
echo 5. Click 'Create & Deploy' -> Instant secure HTTPS URL is provided!
echo ================================================================
pause
