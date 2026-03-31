from functools import lru_cache
from typing import List

import chromadb

from app.config.settings import get_settings


@lru_cache(maxsize=1)
def _get_collection():
	settings = get_settings()
	client = chromadb.PersistentClient(path=str(settings.chroma_persist_path))
	return client.get_or_create_collection(settings.chroma_collection)


def retrieve(query: str, n_results: int | None = None) -> List[str]:
	"""Return top matching document chunks for a query."""
	settings = get_settings()
	limit = n_results or settings.num_context_chunks
	results = _get_collection().query(query_texts=[query], n_results=limit)
	return results.get("documents", [[]])[0]
