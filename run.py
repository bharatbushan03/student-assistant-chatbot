"""Utility script to rebuild the knowledge base and ensure RAG data is loaded."""

import os
import sys
from pathlib import Path


def project_root() -> Path:
    return Path(__file__).resolve().parent


def ensure_import_path() -> None:
    root = project_root()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


def rebuild_kb() -> None:
    os.environ.setdefault("USER_AGENT", "student-assistant-chatbot/0.1")
    from ingestion.langchain_web_loader import main as load_and_chunk
    from ingestion.embed_store import main as embed

    print("[1/2] Loading pages and writing chunks...")
    load_and_chunk()

    print("[2/2] Generating embeddings and pushing to Pinecone...")
    embed()


if __name__ == "__main__":
    ensure_import_path()
    rebuild_kb()
    print("Knowledge base refreshed. You can now start the FastAPI server with uvicorn app.main:app --reload")
