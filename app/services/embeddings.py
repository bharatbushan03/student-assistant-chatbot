import os
from functools import lru_cache
import importlib
from typing import Any

from app.config.settings import get_settings


@lru_cache(maxsize=1)
def get_embedding_model(model_name: str = "sentence-transformers/all-MiniLM-L6-v2") -> Any:
	"""Load and cache the sentence transformer used for ingestion embeddings."""
	sentence_transformers = importlib.import_module("sentence_transformers")
	model_class = getattr(sentence_transformers, "SentenceTransformer")

	settings = get_settings()
	if settings.huggingface_api_token and not os.environ.get("HF_TOKEN"):
		os.environ["HF_TOKEN"] = settings.huggingface_api_token
	return model_class(model_name)
