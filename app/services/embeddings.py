from functools import lru_cache

from sentence_transformers import SentenceTransformer


@lru_cache(maxsize=1)
def get_embedding_model(model_name: str = "sentence-transformers/all-MiniLM-L6-v2") -> SentenceTransformer:
	"""Load and cache the sentence transformer used for ingestion embeddings."""
	return SentenceTransformer(model_name)
