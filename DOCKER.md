# Docker Deployment Guide

## Architecture

The application uses Docker Compose to run 4 services:

| Service | Port | Description |
|---------|------|-------------|
| **Frontend** | 3000 | React app served by Nginx |
| **Auth Backend** | 5000 | Node.js + Express + MongoDB |
| **Chat Backend** | 10000 | FastAPI + Pinecone + HuggingFace |
| **MongoDB** | 27017 | Database for user authentication |

## Quick Start

### 1. Configure Environment Variables

Copy `.env.docker` to `.env` and fill in your API keys:

```bash
cp .env.docker .env
```

**Required values:**
- `MONGODB_URI` - MongoDB connection string (use `mongodb://mongo:27017/miety_auth` for Docker)
- `JWT_SECRET` - Secret key for JWT tokens
- `HUGGINGFACEHUB_API_TOKEN` - Your HuggingFace API token
- `PINECONE_API_KEY` - Your Pinecone API key

### 2. Build Knowledge Base (First Time Only)

Before running Docker, you need to populate the Pinecone index:

```bash
# Activate Python environment
python -m venv myvenv
source myvenv/Scripts/activate  # Windows: myvenv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run ingestion
python run.py
```

### 3. Start All Services

```bash
docker-compose up --build
```

### 4. Access the Application

Open your browser to: **http://localhost:3000**

## Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f frontend
docker-compose logs -f auth-backend
docker-compose logs -f chat-backend

# Stop all services
docker-compose down

# Stop and remove volumes (clears MongoDB data)
docker-compose down -v

# Rebuild a specific service
docker-compose build auth-backend
docker-compose up -d auth-backend

# Run ingestion inside chat-backend container
docker-compose exec chat-backend python run.py
```

## Development Mode

For active development, you may want to run services locally instead of in Docker:

```bash
# Terminal 1 - Auth Backend
cd backend-auth
npm run dev

# Terminal 2 - Chat Backend
python -m uvicorn app.main:app --reload --port 10000

# Terminal 3 - Frontend
cd frontend
npm run dev
```

Make sure `frontend/vite.config.js` has the correct proxy settings:
- `/auth` → `http://127.0.0.1:5000`
- `/chat` → `http://127.0.0.1:10000`

## Troubleshooting

### Registration fails
- Check if auth-backend is running: `docker-compose ps`
- Check MongoDB is connected: `docker-compose logs mongo`
- Verify `MONGODB_URI` in `.env`

### Chat fails
- Check if chat-backend is running
- Verify `HUGGINGFACEHUB_API_TOKEN` and `PINECONE_API_KEY` are set
- Check Pinecone index exists: `docker-compose logs chat-backend`

### Frontend shows blank page
- Check nginx config: `docker-compose logs frontend`
- Verify backend services are healthy

## Production Deployment

For production:
1. Change `JWT_SECRET` to a strong random value
2. Use environment-specific `.env` files
3. Consider using a managed MongoDB (MongoDB Atlas)
4. Add SSL/TLS termination
5. Set up proper logging and monitoring
