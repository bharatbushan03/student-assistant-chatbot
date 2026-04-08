# MIETY AI

A **RAG-powered chatbot** for MIET Jammu students. Ask about admissions, courses, fees, placements, campus life, and more.

Built with **FastAPI** + **Pinecone** + **langchain_openai** (default model: `gpt-4o-mini`).

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/bharatbushan03/student-assistant-chatbot.git
cd student-assistant-chatbot
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key and PINECONE_API_KEY
```

### 3. Build the knowledge base

```bash
python run.py
```

### 4. Start the server

```bash
python -m uvicorn app.main:app --reload --port 10000
```

Backend runs on **http://localhost:10000**.

For frontend local development:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Deploy to Render

1. Push to GitHub
2. Connect the repo on [Render](https://render.com)
3. Set required environment variables in Render:
	- `JWT_SECRET`
	- `MONGODB_URI`
	- `MONGODB_DATABASE`
	- `PINECONE_API_KEY`
	- `OPENAI_API_KEY`
4. Deploy — Render uses the `Dockerfile` and `render.yaml` automatically

---

## Project Structure

```
├── app/
│   ├── main.py                    # FastAPI entry-point
│   ├── config/settings.py         # Environment and runtime settings
│   ├── db/mongodb.py              # MongoDB initialization
│   ├── routes/                    # API routes (auth, chat, groups, projects)
│   ├── services/                  # Business logic (RAG, embeddings, groups, projects)
│   ├── websocket/server.py        # Socket.IO server for real-time group chat
│   ├── models/                    # Internal models
│   ├── schemas/                   # API schemas
│   └── utils/                     # Shared helpers (auth, text cleaning)
├── frontend/                      # React + Vite frontend
├── ingestion/                     # Knowledge-base scraping/chunking/embedding
├── tests/                         # Backend test suite
├── docker-compose.yml             # Local multi-service stack (frontend + backend + mongo)
├── Dockerfile                     # Backend production container
├── render.yaml                    # Render deployment blueprint
└── requirements.txt               # Python dependencies
```

---

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Chat frontend |
| `POST` | `/chat/ask` | Send a question, get an answer |
| `POST` | `/auth/change-password` | Change password for authenticated user |
| `GET` | `/api/projects` | List user projects |
| `POST` | `/api/projects` | Create project workspace |
| `POST` | `/api/projects/{project_id}/chats/{chat_id}/messages/stream` | Stream AI response inside a project chat |
| `POST` | `/api/projects/{project_id}/files` | Upload project files |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger API docs |

## Profile Fields

- Profile now supports an optional `project` field to track a student's current project details.

## Project Workspace

- Added a complete ChatGPT-style project section with isolated projects, chats, files, semantic context retrieval, and streaming responses.
- Full module documentation (architecture, schema, routes, setup): `PROJECT_WORKSPACE_DOCUMENTATION.md`.

---

## License

MIT