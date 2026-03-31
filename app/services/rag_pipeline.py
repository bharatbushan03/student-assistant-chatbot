# app/services/rag_pipeline.py
"""Retrieval-Augmented Generation pipeline using Chroma and an LLM provider."""

from app.config.settings import get_settings
from app.services.llm import get_llm_client
from app.services.retriever import retrieve


settings = get_settings()
llm_client = get_llm_client()


def _build_prompt(query: str, retrieved_chunks: list[str]) -> str:
    context_text = "\n\n".join(retrieved_chunks) if retrieved_chunks else "No context available."
    return (
        "You are a helpful college assistant. Use the context below to answer the question.\n\n"
        f"Context:\n{context_text}\n\nQuestion: {query}\nAnswer:"
    )


def answer_query(query: str) -> str:
    chunks = retrieve(query, n_results=settings.num_context_chunks)
    if not chunks:
        return "Sorry, I could not find relevant information."

    prompt = _build_prompt(query, chunks)
    return llm_client.generate(prompt, max_tokens=300)