from functools import lru_cache
import importlib
from typing import Any

@lru_cache(maxsize=1)
def get_embedding_model(model_name: str = "sentence-transformers/all-MiniLM-L6-v2") -> Any:
	"""Load and cache the sentence transformer used for ingestion embeddings."""
	sentence_transformers = importlib.import_module("sentence_transformers")
	model_class = getattr(sentence_transformers, "SentenceTransformer")
	return model_class(model_name)
