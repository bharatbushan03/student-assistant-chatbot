# MIETY AI

A **RAG-powered chatbot** for MIET Jammu students. Ask about admissions, courses, fees, placements, campus life, and more.

Built with **FastAPI** + **Pinecone** + **NVIDIA Nemotron** (`nvidia/nemotron-3-super-120b-a12b` through the NVIDIA NIM API).

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
# Edit .env and add NVIDIA_API_KEY and PINECONE_API_KEY
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

## Deploy

The API runs on Render. The React app runs on Vercel and calls that API. Deploy the API first so you have a URL for `VITE_API_URL`.

### Backend on Render

1. Push the repo to GitHub.
2. In [Render](https://render.com), create a Blueprint from `render.yaml`, or a new Web Service with Docker and this repo.
3. Set these environment variables on the service:
   - `NVIDIA_API_KEY`
   - `PINECONE_API_KEY`
   - `MONGODB_URI` (Atlas is the practical choice; allow `0.0.0.0/0` so Render can connect)
   - `JWT_SECRET` (a long random string, not the placeholder)
   - `CORS_ORIGINS` set to the Vercel URL after the frontend exists, for example `https://your-app.vercel.app`
4. The image listens on Render's `PORT`. The health check is `GET /health`.
5. Copy the service URL, such as `https://student-assistant-chatbot.onrender.com`.

The first build is slow because the image installs the embedding libraries. The first chat request also downloads the local embedding model onto the instance disk.

### Frontend on Vercel

1. Import the same GitHub repo in [Vercel](https://vercel.com).
2. Leave the root directory as the repository root. `vercel.json` builds `frontend/`.
3. Add an environment variable and then deploy:
   - `VITE_API_URL` = the Render URL, with no trailing slash
4. Vite bakes that value in at build time. If you change it, redeploy.
5. Put the resulting `https://….vercel.app` URL into Render's `CORS_ORIGINS` and redeploy the API.

Preview deployments on `*.vercel.app` are allowed while `CORS_ALLOW_VERCEL_PREVIEWS` is `true`.

Local `npm run dev` does not need `VITE_API_URL`. The Vite dev server proxies `/auth`, `/chat`, `/api`, and `/socket.io` to `http://127.0.0.1:10000`.

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
| `GET` | `/api/admin/overview` | Cohort view of every student dashboard |
| `GET` | `/api/admin/students/{student_id}/dashboard` | Admin/faculty preview of one student dashboard |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger API docs |

## Roles

- **Student** (`yourrollno@mietjammu.in`) registers from the signup page and opens `/student/dashboard`.
- **Faculty** and **admin** (`yourname.dept@mietjammu.in`) are created by an administrator. Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` once to create the first admin, then sign in and use **Student dashboards** at `/admin/dashboard`.
- Faculty edit marks at `/faculty/dashboard` and can open the same student view an admin sees.

## Profile Fields

- Profile now supports an optional `project` field to track a student's current project details.

## Project Workspace

- Added a complete ChatGPT-style project section with isolated projects, chats, files, semantic context retrieval, and streaming responses.
- Full module documentation (architecture, schema, routes, setup): `PROJECT_WORKSPACE_DOCUMENTATION.md`.

---

## License

MIT