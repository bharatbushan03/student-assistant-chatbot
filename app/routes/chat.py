"""Chat route — receives student questions, returns chatbot answers."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from app.models.request_models import AskRequest
from app.services.rag_pipeline import answer_query

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/ask")
async def ask_question(payload: AskRequest):
    """Receive student question and return chatbot answer."""
    try:
        # Run blocking RAG pipeline in a thread pool to avoid blocking the event loop
        answer = await asyncio.to_thread(answer_query, payload.question, payload.history)
        return {"answer": answer}
    except Exception as exc:
        logger.exception("Unhandled error in /chat/ask: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred. Please try again later.",
        ) from exc