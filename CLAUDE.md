# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

"MIETY AI" — RAG-powered college student assistant chatbot for MIET Jammu. Built with FastAPI backend, React frontend, MongoDB for persistence, and Pinecone for vector retrieval. Default LLM: Qwen/Qwen2.5-72B-Instruct via HuggingFace Inference API (OpenAI also supported).

## Architecture

### Three subsystems

1. **RAG Chatbot** (`/chat/*`) — One-off Q&A with document retrieval via Pinecone. Blocking RAG pipeline runs in thread pool via `asyncio.to_thread()`.
2. **Authentication + User Management** (`/auth/*`) — JWT-based auth with bcrypt password hashing. Only `@mietjammu.in` emails can register. MongoDB stores users.
3. **Group Chat** (`/api/groups/*` + WebSocket) — Real-time group messaging via Socket.IO (`app/websocket/server.py`). Features AI participation (tagged responses, auto-respond to questions), file uploads, reactions, read receipts, typing indicators, and conversation summarization. Authenticated via JWT in Socket.IO connect payload.
4. **Project Workspace** (`/api/projects/*`) — ChatGPT-style isolated project workspaces with file upload, semantic file search, streaming SSE responses, cross-chat context retrieval, and export (markdown/JSON/PDF).

### Request Flow

- **Entry point**: `app/main.py` — FastAPI lifespan hooks, CORS, route registration, MongoDB init
- **CORS**: `allow_origins=["*"]` — open for development
- **Routes** registered in `app/main.py`:
  - `chat` → `/chat` (RAG Q&A, file ingestion, MIET web search)
  - `auth` → `/auth` (login/signup/profile/password)
  - `projects` → `/api/projects` (project workspace CRUD + streaming)
  - `groups` → `/api/groups` (group CRUD, member management, AI config)
  - `messages` → `/api/groups` (message history, edit/delete, reactions, search)
- **Socket.IO** mounted as `socketio.ASGIApp(sio, other_asgi_app=fastapi_app)` — runs alongside FastAPI

### Key Patterns

- **Caching**: `@lru_cache(maxsize=1)` for `get_settings()`, `_get_index()`, `get_llm_client()`, `get_embedding_model()` — singletons
- **LLM fallback**: OpenAI used if `OPENAI_API_KEY` is set; falls back to HuggingFace
- **Async**: Blocking RAG and retriever calls use `asyncio.to_thread()`
- **Auth**: JWT tokens with 7-day expiry, decoded in `app/utils/auth.py` via `get_current_user` dependency. All protected routes require valid JWT.
- **Socket.IO auth**: Token passed in Socket.IO `auth` dict on connect, verified in `connect` event
- **Error handling**: MongoDB errors caught by custom `PyMongoError` handler returning 503; LLM errors return 503; unexpected errors return 500
- **Rate limiting**: In-memory sliding window rate limit on project streaming and file upload

### Database Schema (MongoDB)

- `users` — auth + profile (email, password, name, college_id, semester, section, project, profile_picture)
- `groups` — group data with admin/moderator/member roles
- `messages` — group messages with sender info, type, replies, reactions, status tracking
- `ai_context` — per-group AI conversation window (last 20 messages)
- `group_files` — attached file metadata for groups
- `projects` — project workspaces with settings and sharing
- `chats` — project chats
- `project_messages` — AI conversation messages
- `project_files` — uploaded project files
- `activities` — project activity log

### Ingestion Pipeline

Knowledge base built via `run.py` → `ingestion/langchain_web_loader.py` (web scrape + chunk) → `ingestion/embed_store.py` (embed + Pinecone store). Uses sentence-transformers `all-MiniLM-L6-v2`.

## Commands

```bash
# Run dev server
python -m uvicorn app.main:app --reload

# Build knowledge base (required before first start if data/ is empty)
python run.py

# Run tests (mocked, no API keys needed)
pytest tests/ -v

# Run single test
pytest tests/test_chat.py::test_health_check -v

# Build frontend
cd frontend && npm run build

# Docker
docker build -t student-assistant .
docker run -p 10000:10000 -e HUGGINGFACEHUB_API_TOKEN=$HUGGINGFACEHUB_API_TOKEN student-assistant
```

## Environment

Required: `PINECONE_API_KEY` + (`HUGGINGFACEHUB_API_TOKEN` or `OPENAI_API_KEY`).
Optional: `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET` (defaults to insecure value — override in production).

## Frontend

React app in `frontend/` with Vite build. Served from `frontend/dist/` as static files. Components: auth (Login, Signup, ProtectedRoute), ChatWindow, Header, MessageBubble, legal pages. State via AuthContext. API calls via `api.js` utility with JWT auth headers.

## Deployment

- **Docker**: Python 3.11-slim, `PROJECT_ROOT=/app`
- **Render**: `render.yaml` blueprint, health check at `/health`
- **Health endpoint**: `GET /health` → `{"status": "ok"}`
