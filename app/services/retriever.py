"""Pinecone retriever — fetches relevant document chunks for a query."""

import logging
from functools import lru_cache
from typing import List, Dict, Any

from pinecone import Pinecone

from app.config.settings import get_settings
from app.services.embeddings import get_embedding_model

logger = logging.getLogger(__name__)

_NOISE_TOKENS = (
    "terms & conditions",
    "privacy policy",
    "all rights reserved",
    "facebook",
    "twitter",
    "linkedin",
    "instagram",
)


def _is_informative(text: str) -> bool:
    """Filter obvious boilerplate so the LLM receives denser context."""
    lower = text.lower()
    if sum(token in lower for token in _NOISE_TOKENS) >= 2:
        return False
    if len(lower.strip()) < 60:
        return False
    return True


@lru_cache(maxsize=1)
def _get_client() -> Pinecone:
    """Get cached Pinecone client."""
    settings = get_settings()
    if not settings.pinecone_api_key:
        raise RuntimeError("Set PINECONE_API_KEY in your environment to use Pinecone.")
    logger.info("Connecting to Pinecone index: %s", settings.pinecone_index_name)
    return Pinecone(api_key=settings.pinecone_api_key)


@lru_cache(maxsize=1)
def _get_index():
    """Get cached Pinecone index handle."""
    settings = get_settings()
    client = _get_client()
    available = set(client.list_indexes().names())
    if settings.pinecone_index_name not in available:
        raise RuntimeError(
            f"Pinecone index '{settings.pinecone_index_name}' not found. Run the ingestion pipeline to create it."
        )
    return client.Index(settings.pinecone_index_name)


def _encode_query(query: str) -> list[float]:
    """Encode a query string into an embedding list."""
    model = get_embedding_model()
    return model.encode(query).tolist()


def _query_index(vector: list[float], top_k: int) -> list[str]:
    """Query Pinecone and return documents from metadata."""
    index = _get_index()
    response = index.query(
        vector=vector,
        top_k=top_k,
        include_values=False,
        include_metadata=True,
    )

    docs: list[str] = []
    seen_fingerprints: set[str] = set()
    for match in response.get("matches", []):
        metadata = match.get("metadata") or {}
        text = metadata.get("text")
        if not isinstance(text, str) or not text.strip() or not _is_informative(text):
            continue
        fingerprint = " ".join(text.lower().split())[:180]
        if fingerprint in seen_fingerprints:
            continue
        seen_fingerprints.add(fingerprint)
        docs.append(text)
    return docs


def _expand_query(query: str) -> List[str]:
    """
    Expand query with variations to improve retrieval.

    Creates multiple query formulations to catch more relevant chunks.
    """
    queries = [query]

    # Add common variations
    lower_query = query.lower()

    # Course-related expansions
    if any(word in lower_query for word in ['course', 'btech', 'b.tech', 'mtech', 'mba', 'bca', 'mca']):
        queries.append(f"courses programs {query}")
        queries.append(f"admission eligibility {query}")

    # Fee-related expansions
    if any(word in lower_query for word in ['fee', 'fees', 'cost', 'tuition', 'price']):
        queries.append(f"tuition fees structure {query}")
        queries.append(f"fee structure payment {query}")

    # Placement-related expansions
    if any(word in lower_query for word in ['placement', 'job', 'recruit', 'company', 'package']):
        queries.append(f"training placement cell {query}")
        queries.append(f"placement statistics companies {query}")

    # Admission-related expansions
    if any(word in lower_query for word in ['admission', 'apply', 'eligibility', 'entrance']):
        queries.append(f"admission process eligibility {query}")
        queries.append(f"how to apply requirements {query}")

    # Campus-related expansions
    if any(word in lower_query for word in ['campus', 'hostel', 'facilities', 'infrastructure']):
        queries.append(f"campus life facilities {query}")

    return queries


def retrieve(query: str, n_results: int | None = None, use_expansion: bool = True) -> List[str]:
    """
    Return top matching document chunks for a query.

    Args:
        query: The user's question
        n_results: Number of chunks to retrieve (defaults to settings)
        use_expansion: Whether to use query expansion for better retrieval

    Returns:
        List of relevant document chunks
    """
    settings = get_settings()
    limit = n_results or settings.num_context_chunks
    top_k = min(limit + 2, 10)

    try:
        if use_expansion:
            # Try multiple query formulations
            expanded_queries = _expand_query(query)
            all_results = []

            for eq in expanded_queries[:3]:  # Limit to 3 variations
                vector = _encode_query(eq)
                docs = _query_index(vector, top_k)
                all_results.append(docs)

            # Merge and deduplicate results by document content
            seen_docs = set()
            merged_docs = []

            for results in all_results:
                for doc in results:
                    # Use first 100 chars as fingerprint
                    doc_fingerprint = doc[:100].strip() if doc else ""
                    if doc_fingerprint and doc_fingerprint not in seen_docs:
                        seen_docs.add(doc_fingerprint)
                        merged_docs.append(doc)

            # Return top N unique documents
            final_docs = merged_docs[:limit]
            logger.info("Retrieved %d unique chunks for query (expanded from %d queries)",
                       len(final_docs), len(expanded_queries))
            return final_docs

        else:
            # Simple single-query retrieval
            vector = _encode_query(query)
            documents = _query_index(vector, limit)
            logger.info("Retrieved %d chunks for query", len(documents))
            return documents

    except Exception as exc:
        logger.error("Retrieval failed: %s", exc)
        raise


def retrieve_with_scores(query: str, n_results: int | None = None) -> List[Dict[str, Any]]:
    """
    Return chunks with relevance scores for debugging.

    Returns list of dicts with 'content' and 'score' keys.
    """
    settings = get_settings()
    limit = n_results or settings.num_context_chunks
    vector = _encode_query(query)
    index = _get_index()

    results = index.query(
        vector=vector,
        top_k=limit,
        include_values=False,
        include_metadata=True,
    )

    matches = results.get("matches", [])
    results: list[dict[str, Any]] = []
    seen_fingerprints: set[str] = set()
    for match in matches:
        content = (match.get("metadata") or {}).get("text", "")
        if not isinstance(content, str) or not _is_informative(content):
            continue
        fingerprint = " ".join(content.lower().split())[:180]
        if fingerprint in seen_fingerprints:
            continue
        seen_fingerprints.add(fingerprint)
        results.append(
            {
                "content": content,
                "score": match.get("score", 0.0),
            }
        )

    return results
