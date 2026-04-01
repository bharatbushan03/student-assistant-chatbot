"""Retrieval-Augmented Generation pipeline using Pinecone and an LLM provider."""

import logging
from typing import List, Dict

from app.config.settings import get_settings
from app.services.llm import get_llm_client
from app.services.retriever import retrieve

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are MIET Assistant, an official AI chatbot for Model Institute of Engineering and Technology (MIET) Jammu.

Your role is to help students with accurate information about MIET Jammu based on the retrieved context provided.

INSTRUCTIONS:
1. Answer ONLY based on the provided context. Do not use outside knowledge.
2. If the context contains specific details (numbers, dates, names, eligibility criteria, fees), include them in your answer.
3. If the context is insufficient, say "I don't have enough information about that in my knowledge base" and suggest related topics.
4. Be concise but complete. Include relevant specifics like:
   - Fee amounts and payment schedules
   - Eligibility percentages and entrance exam requirements
   - Course durations and specializations
   - Contact numbers and email addresses
   - Important dates and deadlines
5. Structure your answer clearly with bullet points or numbered lists when appropriate.
6. If the user asks about something not in the context, acknowledge this limitation honestly.

Remember: The user is a student or parent seeking information about MIET Jammu. Be helpful, professional, and accurate."""


def format_context(chunks: List[str]) -> str:
    """Format retrieved chunks into a structured context string."""
    if not chunks:
        return "No relevant information found in the knowledge base."

    formatted = []
    for i, chunk in enumerate(chunks, 1):
        # Clean up the chunk
        cleaned = chunk.strip()
        if cleaned:
            formatted.append(f"[Document {i}]\n{cleaned}\n")

    return "\n".join(formatted)


def answer_query(query: str, history: List[Dict[str, str]] = None) -> str:
    """
    Main RAG pipeline: retrieve context → build message array → generate answer.

    Args:
        query: The user's question
        history: Optional conversation history for context

    Returns:
        The generated answer from the LLM
    """
    settings = get_settings()

    try:
        # Retrieve relevant chunks with query expansion for better coverage
        chunks = retrieve(query, n_results=settings.num_context_chunks, use_expansion=True)
    except Exception as exc:
        logger.error("Retrieval failed: %s", exc)
        return "I'm having trouble accessing the knowledge base right now. Please try again in a moment."

    if not chunks:
        return """I couldn't find specific information about that in my knowledge base.

I can help you with questions about:
• Admissions and eligibility criteria
• Fee structure for various courses
• B.Tech, M.Tech, MBA, BBA, BCA, MCA, and other programs
• Placements and training programs
• Campus facilities and student life

Could you try rephrasing your question or ask about one of these topics?"""

    # Format the context
    context_text = format_context(chunks)

    # Build the user prompt with context
    user_prompt = f"""Based on the following information from MIET Jammu's official sources, please answer the question.

RETRIEVED INFORMATION:
{context_text}

USER QUESTION: {query}

Please provide a complete and accurate answer based on the information above."""

    # Construct the message array
    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]

    # Append conversation history if available
    if history:
        # Keep only last 6 messages to stay within token limits
        recent_history = history[-6:]
        messages.extend(recent_history)

    # Append current query with context
    messages.append({
        "role": "user",
        "content": user_prompt
    })

    try:
        # Generate response
        response = get_llm_client().generate(messages, max_tokens=500)
        return response.strip()

    except RuntimeError as exc:
        logger.error("LLM generation error: %s", exc)
        return str(exc)
    except Exception as exc:
        logger.error("LLM generation failed: %s", exc)
        return "I'm experiencing technical difficulties. Please try again in a moment."


def answer_query_debug(query: str) -> Dict:
    """
    Debug version that returns retrieved chunks alongside the answer.

    Useful for testing and debugging retrieval quality.
    """
    from app.services.retriever import retrieve_with_scores

    settings = get_settings()

    # Get chunks with scores
    chunks_with_scores = retrieve_with_scores(query, n_results=settings.num_context_chunks)

    # Get the answer
    answer = answer_query(query)

    return {
        "query": query,
        "answer": answer,
        "retrieved_chunks": chunks_with_scores,
        "num_chunks": len(chunks_with_scores)
    }
