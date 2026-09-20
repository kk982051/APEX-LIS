# ===================================================================
# Stage 1: Build React 18 Production Bundle (Vite)
# ===================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ===================================================================
# Stage 2: Production Python 3.12 Backend & Unified Cloud Run Container
# ===================================================================
FROM python:3.12-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# Install runtime tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application
COPY backend/ ./backend/

# Copy built frontend assets directly into static folder
COPY --from=frontend-builder /app/frontend/dist ./backend/static

EXPOSE 8080 5100 5101

WORKDIR /app/backend

# Cloud Run dynamic PORT injection
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
