"""FastAPI application entry-point with CORS, static file serving, and route registration."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pymongo.errors import PyMongoError
import socketio

from app.routes import admin, chat, auth, academics, groups, messages, projects
from app.websocket.server import sio

logger = logging.getLogger("uvicorn.error")

FRONTEND_ROOT_DIR = Path(__file__).resolve().parent.parent / "frontend"
FRONTEND_DIST_DIR = FRONTEND_ROOT_DIR / "dist"


def _resolve_frontend_file(relative_path: str) -> Path | None:
        """Return a file inside the built frontend directory if it exists."""
        if not FRONTEND_DIST_DIR.exists():
                return None

        candidate = (FRONTEND_DIST_DIR / relative_path.lstrip("/")).resolve()
        try:
                candidate.relative_to(FRONTEND_DIST_DIR.resolve())
        except ValueError:
                return None

        return candidate if candidate.is_file() else None


def _frontend_unavailable_response(detail_message: str) -> HTMLResponse:
        """Return a small HTML page explaining that the frontend bundle is missing."""
        return HTMLResponse(
                f"""<!doctype html>
<html lang=\"en\">
    <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>MIETY AI</title>
        <style>
            :root {{
                color-scheme: light;
                font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;
            }}
            body {{
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
                color: #0f172a;
            }}
            main {{
                max-width: 640px;
                padding: 32px;
                margin: 24px;
                border: 1px solid #dbe3f0;
                border-radius: 20px;
                background: rgba(255, 255, 255, 0.92);
                box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
            }}
            h1 {{ margin: 0 0 12px; font-size: 2rem; }}
            p {{ margin: 0 0 12px; line-height: 1.6; }}
            code {{ background: #e2e8f0; padding: 2px 6px; border-radius: 6px; }}
            a {{ color: #2563eb; text-decoration: none; }}
        </style>
    </head>
    <body>
        <main>
            <h1>MIETY AI frontend not built</h1>
            <p>{detail_message}</p>
            <p>Build the frontend with <code>cd frontend && npm run build</code>, then refresh this page.</p>
            <p>API docs are still available at <a href=\"/docs\">/docs</a>.</p>
        </main>
    </body>
</html>""",
                status_code=200,
                media_type="text/html",
        )


def _check_required_settings():
    """Validate required environment variables at startup."""
    from app.config.settings import get_settings
    settings = get_settings()

    missing = []
    if not settings.pinecone_api_key:
        missing.append("PINECONE_API_KEY")
    if not settings.nvidia_api_key:
        missing.append("NVIDIA_API_KEY")

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
        from app.services.bootstrap import ensure_bootstrap_admin
        await ensure_bootstrap_admin()
    except Exception as e:
        logger.warning(
            "⚠️  MongoDB connection failed during startup: %s. "
            "Continuing without DB-dependent features.",
            e,
        )

    logger.info("✅  Configuration validated")
    yield

    # Cleanup on shutdown
    await close_client()
    logger.info("👋  Shutting down")


fastapi_app = FastAPI(
    title="MIETY AI",
    description="RAG campus platform for MIET Jammu. Answers use NVIDIA Nemotron with Pinecone retrieval.",
    version="1.0.0",
    lifespan=lifespan,
)


@fastapi_app.exception_handler(PyMongoError)
async def handle_mongodb_errors(request: Request, exc: PyMongoError):
    """Return a stable API response when MongoDB is unavailable."""
    logger.error("❌  MongoDB operation failed on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "Database service is temporarily unavailable. Please try again shortly."},
    )

# ── CORS ──────────────────────────────────────────────────────────────
def _cors_middleware_kwargs() -> dict:
    """Allow the Vercel frontend, local Vite, and optional preview deploys."""
    from app.config.settings import get_settings

    settings = get_settings()
    raw = (settings.cors_origins or "*").strip()
    if raw == "*":
        return {
            "allow_origins": ["*"],
            "allow_credentials": False,
            "allow_methods": ["*"],
            "allow_headers": ["*"],
        }

    origins = [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]
    for local_origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
        if local_origin not in origins:
            origins.append(local_origin)

    kwargs = {
        "allow_origins": origins,
        "allow_credentials": False,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    if settings.cors_allow_vercel_previews:
        kwargs["allow_origin_regex"] = r"https://([a-zA-Z0-9-]+\.)*vercel\.app"
    return kwargs


fastapi_app.add_middleware(CORSMiddleware, **_cors_middleware_kwargs())

# ── WebSocket (Socket.IO) ────────────────────────────────────────────
# Mount Socket.IO server for real-time group messaging
# Note: Socket.IO is mounted separately and runs alongside FastAPI
# Access at /socket.io endpoint for WebSocket connections

# ── Health check (before catch-all) ──────────────────────────────────
@fastapi_app.get("/health", include_in_schema=False)
async def health_check():
    """Simple health check for Render / uptime monitors."""
    from app.config.settings import get_settings
    settings = get_settings()
    return {
        "status": "ok",
        "llm": {
            "provider": "nvidia_nemotron",
            "model": settings.nvidia_model,
        },
        "vector_db": {
            "provider": "pinecone",
            "index": settings.pinecone_index_name,
        },
    }

# ── API routes ────────────────────────────────────────────────────────
fastapi_app.include_router(chat.router, prefix="/chat", tags=["Chat"])
fastapi_app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
fastapi_app.include_router(academics.router, prefix="/api/academics", tags=["Academics"])
fastapi_app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
fastapi_app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
fastapi_app.include_router(groups.router, prefix="/api/groups", tags=["Groups"])
fastapi_app.include_router(messages.router, prefix="/api/groups", tags=["Messages"])

@fastapi_app.get("/", include_in_schema=False)
async def serve_frontend():
    """Serve the chat frontend at the root URL."""
    index_file = _resolve_frontend_file("index.html")
    if index_file is not None:
        return FileResponse(index_file)

    logger.warning("⚠️  Frontend directory not found at %s. Static files will not be served.", FRONTEND_DIST_DIR)
    return _frontend_unavailable_response(
        f"FastAPI is running, but the built frontend was not found at {FRONTEND_DIST_DIR}."
    )


@fastapi_app.get("/{catchall:path}", include_in_schema=False)
async def catch_all(catchall: str):
    """Serve built frontend files or fall back to the SPA entry page."""
    file_path = _resolve_frontend_file(catchall)
    if file_path is not None:
        return FileResponse(file_path)

    index_file = _resolve_frontend_file("index.html")
    if index_file is not None:
        return FileResponse(index_file)

    return _frontend_unavailable_response(
        f"Path /{catchall} not found because the built frontend is missing at {FRONTEND_DIST_DIR}."
    )


app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)