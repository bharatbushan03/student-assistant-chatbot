# API image for Cloudflare Containers. The React app is served by the Worker.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/tmp/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/tmp/sentence-transformers

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY run.py ./
COPY ingestion/ ./ingestion/

EXPOSE 8080

# Cloudflare Containers set PORT=8080. Local Docker falls back to 10000.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
