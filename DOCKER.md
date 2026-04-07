# Docker Deployment Guide

## Architecture

This project runs as 3 services in Docker Compose:

| Service | Port | Description |
|---------|------|-------------|
| **Frontend** | 3000 | React app served by Nginx |
| **Chat Backend** | 10000 | FastAPI (auth + chat + groups + projects) |
| **MongoDB** | 27017 | Primary application database |

Authentication is handled by FastAPI at `/auth`; there is no separate Node auth service.

## Quick Start

### 1. Configure environment variables

Copy `.env.docker` to `.env` and update placeholders:

```bash
cp .env.docker .env
```

Required values:
- `JWT_SECRET`
- `HUGGINGFACEHUB_API_TOKEN` or `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- `MONGODB_URI` (defaults to `mongodb://mongo:27017/miety_ai`)
- `MONGODB_DATABASE` (defaults to `miety_ai`)

### 2. Build the knowledge base (first run)

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

### 3. Start all services

```bash
docker-compose up --build
```

### 4. Open the app

Visit http://localhost:3000

## Useful Commands

```bash
# Start in detached mode
docker-compose up -d

# Follow logs
docker-compose logs -f

# Service-specific logs
docker-compose logs -f frontend
docker-compose logs -f chat-backend
docker-compose logs -f mongo

# Stop services
docker-compose down

# Stop and wipe Mongo volume
docker-compose down -v

# Run ingestion inside backend container
docker-compose exec chat-backend python run.py
```

## Local Development (without Docker)

```bash
# Terminal 1: backend
python -m uvicorn app.main:app --reload --port 10000

# Terminal 2: frontend
cd frontend
npm run dev
```

Expected Vite proxy targets:
- `/auth` -> `http://127.0.0.1:10000`
- `/chat` -> `http://127.0.0.1:10000`
- `/api/groups` -> `http://127.0.0.1:10000`
- `/api/projects` -> `http://127.0.0.1:10000`

## Troubleshooting

### Frontend is up but auth/chat fails
- Check backend health at `http://localhost:10000/health`
- Confirm JWT/API keys in `.env`
- Check backend logs: `docker-compose logs -f chat-backend`

### Database errors
- Ensure Mongo is running: `docker-compose ps`
- Verify `MONGODB_URI` and `MONGODB_DATABASE` values

### AI responses fail
- Ensure at least one LLM credential is set: `HUGGINGFACEHUB_API_TOKEN` or `OPENAI_API_KEY`
- Confirm Pinecone credentials/index are valid

## Production Notes

1. Set a strong `JWT_SECRET`
2. Replace placeholder API tokens
3. Use HTTPS termination (reverse proxy or managed platform)
4. Restrict CORS to trusted origins
5. Add monitoring, alerts, and structured log shipping
