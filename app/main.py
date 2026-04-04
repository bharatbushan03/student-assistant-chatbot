"""FastAPI application entry-point with CORS, static file serving, and route registration."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routes import chat, auth

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

    # Initialize MongoDB connection
    from app.db.mongodb import get_client, close_client
    try:
        client = get_client()
        # Ping MongoDB to verify connection
        await client.admin.command('ping')
        logger.info("✅  MongoDB connected")
    except Exception as e:
        logger.error(f"❌  MongoDB connection failed: {e}")
        raise

    logger.info("✅  Configuration validated")
    yield

    # Cleanup on shutdown
    await close_client()
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

# ── Health check (before catch-all) ──────────────────────────────────
@app.get("/health", include_in_schema=False)
async def health_check():
    """Simple health check for Render / uptime monitors."""
    return {"status": "ok"}

# ── API routes ────────────────────────────────────────────────────────
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# ── Static files (frontend) ──────────────────────────────────────────
# Pointing to the built React Vite app
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIR.exists():
    # Only mount if directories exist
    assets_dir = FRONTEND_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
    
    # Mount dist as static for other files (index.html, manifest, etc.)
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    async def serve_frontend():
        """Serve the chat frontend at the root URL."""
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"detail": "Frontend index.html not found. Please build the frontend."}

    @app.get("/{catchall:path}", include_in_schema=False)
    async def catch_all(catchall: str):
        """Fallback route for SPA navigation, pointing to index.html if file not found."""
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"detail": f"Path /{catchall} not found and frontend fallback unavailable."}
else:
    logger.warning("⚠️  Frontend directory not found at %s. Static files will not be served.", FRONTEND_DIR)
    
    @app.get("/", include_in_schema=False)
    async def serve_no_frontend():
        return {"detail": "FastAPI is running. Frontend not found. If you are using Docker, ensure the frontend is built and mapped correctly."}