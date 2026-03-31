# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **RAG-based College Student Assistant Chatbot** for MIET Jammu. It uses FastAPI for the backend API, ChromaDB for vector storage, and Hugging Face Inference API (mistralai/Mistral-7B-Instruct-v0.2) for LLM responses. The chatbot answers student queries about admissions, courses, fees, campus life, and other college-related information by retrieving relevant context from scraped website data.

## Architecture

### Backend (FastAPI)
- **Entry point**: `app/main.py` - FastAPI app with router inclusion
- **Routes**: `app/routes/chat.py` - `/chat/ask` endpoint receives questions and returns answers
- **RAG Pipeline**: `app/services/rag_pipeline.py` - orchestrates retrieval from ChromaDB and answer generation via LLM
- **Services**:
  - `embeddings.py` - (placeholder for embedding utilities)
  - `retriever.py` - (placeholder for retrieval utilities)
  - `llm.py` - LLMClient supporting both OpenAI and Hugging Face Inference API (auto-selects based on env vars)
- **Config**: `app/config/settings.py` - Pydantic settings with env var support

### Data Ingestion Pipeline
The ingestion workflow processes website data for the knowledge base:

1. **Scrape**: `ingestion/langchain_web_loader.py` - Scrapes 66 MIET Jammu URLs using WebBaseLoader, splits into chunks with RecursiveCharacterTextSplitter (1000 chars, 50 overlap)
2. **Clean**: `ingestion/clean.py` - (placeholder for text cleaning)
3. **Chunk**: `ingestion/chunk.py` - (placeholder for chunking logic)
4. **Embed & Store**: `ingestion/embed_store.py` - Generates embeddings using `sentence-transformers/all-MiniLM-L6-v2`, stores in ChromaDB collection `miet_jammu_collection`

### Frontend
- `frontend/index.html`, `app.js`, `styles.css` - Static frontend files (currently placeholders)

### Data Directories
- `data/raw/` - Raw scraped content
- `data/processed/` - Processed chunks (e.g., `chunks.txt`)
- `data/embeddings/` - ChromaDB persistent storage

## Common Commands

### Run the API Server
```bash
uvicorn app.main:app --reload
```
The API will be available at `http://localhost:8000`

### Run the Chat Endpoint
```bash
curl -X POST "http://localhost:8000/chat/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the admission requirements?"}'
```

### Ingest Data (Rebuild Knowledge Base)
```bash
# Step 1: Scrape and chunk
python ingestion/langchain_web_loader.py

# Step 2: Generate embeddings and store
python ingestion/embed_store.py
```

### Run Tests
```bash
pytest tests/
# or for a single test:
pytest tests/test_chat.py -v
```

## Environment Configuration

Create a `.env` file in the project root. Configure **either** Hugging Face or OpenAI:

**Hugging Face (default):**
```
HUGGINGFACEHUB_API_TOKEN=your_hf_token_here
```

**OpenAI (alternative):**
```
OPENAI_API_KEY=your_openai_api_key_here
```

The `llm.py` service auto-detects which provider to use based on which API key is set. If both are set, OpenAI takes precedence.

## Important Implementation Details

### RAG Pipeline Flow
1. Query is received at `/chat/ask` endpoint
2. `answer_query()` retrieves top-3 relevant chunks from ChromaDB collection
3. Chunks are formatted into a prompt with system context: "You are a helpful college assistant"
4. LLM generates the response (Hugging Face Inference API with mistralai/Mistral-7B-Instruct-v0.2, or OpenAI if configured)

### ChromaDB Collections
- Collection name: `miet_jammu_collection` (used consistently in both ingestion and runtime)
- Persistence path: `data/embeddings/chroma_db`

### Known Issues
- Several service files are empty placeholders (embeddings.py, retriever.py, llm.py, clean.py, chunk.py, scrape.py)
- Frontend files are empty
- Test file is empty
