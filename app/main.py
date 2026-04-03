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


def _check_required_settings():
    """Validate required environment variables at startup."""
    from app.config.settings import get_settings
    settings = get_settings()

    missing = []
    if not settings.pinecone_api_key:
        missing.append("PINECONE_API_KEY")
    if not settings.huggingface_api_token and not settings.openai_api_key:
        missing.append("HUGGINGFACEHUB_API_TOKEN or OPENAI_API_KEY")

    if missing:
        logger.error("Missing required environment variables: %s", ", ".join(missing))
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup / shutdown lifecycle hook."""
    logger.info("🚀  MIETY AI is starting up")
    _check_required_settings()
    logger.info("✅  Configuration validated")
    yield
    logger.info("👋  Shutting down")


app = FastAPI(
    title="MIETY AI",
    description="RAG-powered chatbot for MIET Jammu students",
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
# Pointing to the built React Vite app
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "miety-ai-react" / "dist"

app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")

@app.get("/", include_in_schema=False)
async def serve_frontend():
    """Serve the chat frontend at the root URL."""
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/{catchall:path}", include_in_schema=False)
async def catch_all(catchall: str):
    """Fallback route for SPA navigation, pointing to index.html if file not found."""
    return FileResponse(FRONTEND_DIR / "index.html")

@app.get("/health")
async def health_check():
    """Simple health check for Render / uptime monitors."""
    return {"status": "ok"}