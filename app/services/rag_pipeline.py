"""Retrieval-Augmented Generation pipeline using Pinecone and an LLM provider."""

import logging
from typing import List, Dict

from app.config.settings import get_settings
from app.services.llm import get_llm_client
from app.services.retriever import retrieve
from app.services.web_search import search_miet_specific

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are MIETY AI, an AI chatbot for Model Institute of Engineering and Technology (MIET) Jammu.

CRITICAL INSTRUCTIONS:
1. Answer ONLY the specific question asked - nothing more, nothing less.
2. DO NOT add unrelated information, tangential details, or "helpful" extras.
3. If context contains the answer, use it. If context does NOT have the answer, use your general knowledge about MIET Jammu and Indian engineering colleges.
4. NEVER say "the context does not mention" or "I don't have enough information" - instead provide useful information from your knowledge.
5. Be direct and concise - 2-4 sentences maximum unless the question requires more.
6. DO NOT list other topics, services, or suggest alternative questions.

Answer the question directly. No introductions, no conclusions, no suggestions."""


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
        # No context found - try web search first, then fall back to LLM
        logger.info("No context found, searching web for: %s", query)

        web_context = search_miet_specific(query)

        if web_context:
            logger.info("Web search found information, using it for response")
            user_prompt = f"""Web search results about MIET:
{web_context}

Question: {query}

Answer based on the search results above. Be direct and concise - 2-4 sentences max."""
        else:
            logger.info("Web search returned no results, using LLM knowledge")
            user_prompt = f"Question: {query}\n\nAnswer based on your knowledge about MIET Jammu. Be direct and concise."

        messages = [
            {
                "role": "system",
                "content": """You are MIETY AI, an AI chatbot for MIET Jammu.
Answer questions accurately and concisely. 2-4 sentences max. No introductions or suggestions."""
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ]

        try:
            response = get_llm_client().generate(messages, max_tokens=400)
            return response.strip()
        except RuntimeError as exc:
            logger.error("LLM generation error for no-context query: %s", exc)
            raise
        except Exception as exc:
            logger.error("LLM generation failed for no-context query: %s", exc)
            return "I couldn't find specific information. Please check MIET's official website."

    # Format the context
    context_text = format_context(chunks)

    # Check if context seems relevant to the query (simple heuristic)
    context_lower = context_text.lower()
    query_lower = query.lower()

    # Check if key query terms appear in context
    key_terms = [word for word in query_lower.split() if len(word) > 3 and word not in ['what', 'which', 'where', 'about', 'tell', 'please', 'current', 'specific']]
    context_has_key_terms = any(term in context_lower for term in key_terms)

    # For queries about people/directorship, always try web search for most current info
    needs_current_info = any(kw in query_lower for kw in ['director', 'principal', 'chairperson', 'head', 'chief', 'president', 'who is'])

    # If context doesn't seem relevant OR query needs current info, try web search
    if not context_has_key_terms or needs_current_info:
        logger.info("Context may not be relevant or needs current info, trying web search for: %s", query)
        web_context = search_miet_specific(query)
        if web_context:
            logger.info("Using web search results")
            context_text = web_context

    # Build the user prompt with context
    user_prompt = f"""Context from MIET sources:
{context_text}

Question: {query}

Instructions:
1. If the context contains the answer, use it to provide a specific, detailed response.
2. If the context does NOT contain the answer, use your general knowledge about MIET Jammu and Indian engineering colleges.
3. Be direct and concise - 2-4 sentences max.
4. Never say "the context does not mention" - provide useful information.

Answer the question directly."""

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
        raise
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
