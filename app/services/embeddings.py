import os
from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.config.settings import get_settings


@lru_cache(maxsize=1)
def get_embedding_model(model_name: str = "sentence-transformers/all-MiniLM-L6-v2") -> SentenceTransformer:
	"""Load and cache the sentence transformer used for ingestion embeddings."""
	settings = get_settings()
	if settings.huggingface_api_token and not os.environ.get("HF_TOKEN"):
		os.environ["HF_TOKEN"] = settings.huggingface_api_token
	return SentenceTransformer(model_name)
