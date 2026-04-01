"""FastAPI application entry-point with CORS, static file serving, and route registration."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routes import chat

logger = logging.getLogger("uvicorn.error")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup / shutdown lifecycle hook."""
    logger.info("🚀  Student Assistant Chatbot is starting up")
    yield
    logger.info("👋  Shutting down")


app = FastAPI(
    title="MIET Student Assistant Chatbot",
    description="RAG-powered chatbot that answers student queries about MIET Jammu",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routes ────────────────────────────────────────────────────────
app.include_router(chat.router, prefix="/chat", tags=["Chat"])

# ── Static files (frontend) ──────────────────────────────────────────
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/", include_in_schema=False)
async def serve_frontend():
    """Serve the chat frontend at the root URL."""
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/health")
async def health_check():
    """Simple health check for Render / uptime monitors."""
    return {"status": "ok"}