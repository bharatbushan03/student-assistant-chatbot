# ── Stage 1: Build the Frontend ─────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /build

# Copy frontend source and configuration
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Final Backend Image ───────────────────────────────────────
FROM python:3.11-slim

# Prevent .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY app/ ./app/
COPY run.py ./
COPY ingestion/ ./ingestion/

# Copy the built frontend artifacts from Stage 1
# This places them exactly where app/main.py expects them
COPY --from=frontend-builder /build/dist ./frontend/dist

# Expose port
EXPOSE 10000

# Start uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10000"]
