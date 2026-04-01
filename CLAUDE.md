# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RAG-based College Student Assistant Chatbot for MIET Jammu. Uses FastAPI + Pinecone + HuggingFace Inference API (default: Qwen/Qwen2.5-72B-Instruct).

## Architecture

### Request Flow
1. **Entry point**: `app/main.py` — FastAPI with CORS, static files, health check
2. **Route**: `app/routes/chat.py` — POST `/chat/ask` (runs blocking RAG pipeline via `asyncio.to_thread`)
3. **RAG Pipeline**: `app/services/rag_pipeline.py` — retrieve → build prompt → generate
4. **LLM**: `app/services/llm.py` — supports OpenAI and HuggingFace Inference API
5. **Retriever**: `app/services/retriever.py` — Pinecone vector search
6. **Config**: `app/config/settings.py` — Pydantic settings with PROJECT_ROOT support
7. **Frontend**: `frontend/` — served as static files at `/static/`, root `/` serves index.html

### Key Patterns
- **Caching**: `@lru_cache(maxsize=1)` used for `get_settings()`, `_get_collection()`, and `get_llm_client()` — these are singletons loaded once at startup
- **LLM Provider Priority**: OpenAI takes precedence if `OPENAI_API_KEY` is set; falls back to HuggingFace if only `HUGGINGFACEHUB_API_TOKEN` is present
- **Async Handling**: Blocking operations (RAG pipeline, Pinecone queries) run in thread pool via `asyncio.to_thread()`
- **Error Handling**: LLM client raises `RuntimeError` with user-friendly messages; unexpected errors return HTTP 500 with generic message

### Ingestion Pipeline
The knowledge base is built via `run.py` which orchestrates:
1. `ingestion/langchain_web_loader.py` — scrapes MIET Jammu URLs, cleans text, chunks with overlap
2. `ingestion/embed_store.py` — generates embeddings using sentence-transformers, stores in Pinecone

## Commands

```bash
# Run dev server
python -m uvicorn app.main:app --reload

# Rebuild knowledge base (must run before first start if data/ is empty)
python run.py

# Run all tests
pytest tests/ -v

# Run single test
pytest tests/test_chat.py::test_health_check -v

# Docker build and run
docker build -t student-assistant .
docker run -p 10000:10000 -e HUGGINGFACEHUB_API_TOKEN=$HUGGINGFACEHUB_API_TOKEN student-assistant
```

## Environment

Set `HUGGINGFACEHUB_API_TOKEN` in `.env` (see `.env.example`). Optionally set `OPENAI_API_KEY` to use OpenAI instead.

## Deployment

- **Docker**: Production Dockerfile uses Python 3.11-slim, sets `PROJECT_ROOT=/app`
- **Render**: Uses `render.yaml` blueprint with health check at `/health`, expects `HUGGINGFACEHUB_API_TOKEN` env var
