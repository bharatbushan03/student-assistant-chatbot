"""Chat route — receives student questions, returns chatbot answers."""

import asyncio
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import ValidationError

from app.config.settings import get_settings
from app.models.request_models import AskRequest
from app.services.file_attachment_service import ingest_upload_file
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


def answer_query(question: str, history=None):
    """Load and run the RAG pipeline lazily to reduce import-time dependencies."""
    from app.services.rag_pipeline import answer_query as _answer_query
    return _answer_query(question, history)


def get_miet_basic_info():
    """Load web utilities lazily to keep route import lightweight."""
    from app.services.web_search import get_miet_basic_info as _get_miet_basic_info
    return _get_miet_basic_info()


def search_miet_specific(query: str):
    """Load web search function lazily."""
    from app.services.web_search import search_miet_specific as _search_miet_specific
    return _search_miet_specific(query)


def scrape_miet_page(url_path: str):
    """Load page scraping utility lazily."""
    from app.services.web_search import scrape_miet_page as _scrape_miet_page
    return _scrape_miet_page(url_path)


@router.post("/ask")
async def ask_question(payload: AskRequest, current_user: dict = Depends(get_current_user)):
    """Receive student question and return chatbot answer. Required valid JWT token."""
    try:
        # Run blocking RAG pipeline in a thread pool to avoid blocking the event loop
        answer = await asyncio.to_thread(answer_query, payload.question, payload.history)
        return {"answer": answer}
    except ValidationError as exc:
        # Re-raise validation errors from Pydantic
        raise
    except RuntimeError as exc:
        # LLM or retrieval errors that are already user-friendly
        logger.error("Runtime error in /chat/ask: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Unhandled error in /chat/ask: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred. Please try again later.",
        ) from exc


@router.post("/files/ingest")
async def ingest_chat_files(
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Ingest chat attachments and return extracted text snippets for prompt context."""
    max_bytes = get_settings().project_upload_max_mb * 1024 * 1024
    processed_files = []

    for upload in files:
        try:
            parsed = await ingest_upload_file(upload, max_bytes=max_bytes)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("Chat file ingestion failed: %s", exc)
            raise HTTPException(status_code=400, detail="Unable to process one or more uploaded files.") from exc

        processed_files.append({
            "id": uuid4().hex,
            "name": parsed["filename"],
            "content_type": parsed["content_type"],
            "size_bytes": parsed["size_bytes"],
            "preview_text": parsed["preview_text"],
            "extracted_text": parsed["extracted_text"],
        })

    return {"files": processed_files}


@router.get("/miet-info")
async def get_miet_info():
    """Get basic information about MIET scraped from the official website."""
    try:
        info = await asyncio.to_thread(get_miet_basic_info)
        return {"info": info}
    except Exception as exc:
        logger.exception("Failed to fetch MIET info: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Unable to fetch information from MIET website at this time.",
        ) from exc


@router.get("/search")
async def search_miet(q: str):
    """Search MIET website for information."""
    try:
        result = await asyncio.to_thread(search_miet_specific, q)
        return {"query": q, "result": result}
    except Exception as exc:
        logger.exception("Search failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Search failed.",
        ) from exc


@router.get("/scrape-page")
async def scrape_page(url_path: str):
    """Scrape a specific MIET page by providing its URL path."""
    try:
        result = await asyncio.to_thread(scrape_miet_page, url_path)
        return result
    except Exception as exc:
        logger.exception("Scrape failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to scrape page.",
        ) from exc