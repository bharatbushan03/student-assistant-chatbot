# ── Stage 1: Build the React Application ──
FROM node:20-slim AS frontend-build
WORKDIR /app/miety-ai-react

# Install tools if needed by dependencies
COPY miety-ai-react/package*.json ./
RUN npm install

# Build the React app
COPY miety-ai-react ./
RUN npm run build


# ── Stage 2: Build the FastAPI Backend ──
FROM python:3.11-slim

# Prevent .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . .

# Copy built React files from Stage 1 into the target directory
# This allows FastAPI to serve the built index.html and assets
COPY --from=frontend-build /app/miety-ai-react/dist /app/miety-ai-react/dist

# Expose the standard Render or Railway port
EXPOSE 10000

# Start uvicorn
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
