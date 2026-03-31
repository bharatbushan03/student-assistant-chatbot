# app/routes/chat.py
from fastapi import APIRouter

from app.models.request_models import AskRequest
from app.services.rag_pipeline import answer_query

router = APIRouter()

@router.post("/ask")
async def ask_question(payload: AskRequest):
    """Receive student question and return chatbot answer."""
    answer = answer_query(payload.question)
    return {"answer": answer}