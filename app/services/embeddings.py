"""Query and document embeddings through the NVIDIA API. No local model download."""

import logging
from functools import lru_cache

from openai import OpenAI

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


class EmbeddingResult:
    """Small stand-in for the array shape the ingestion code expects."""

    def __init__(self, vectors: list[float] | list[list[float]], single: bool):
        self._vectors = vectors
        self._single = single

    def tolist(self):
        return self._vectors

    @property
    def shape(self):
        if self._single:
            return (len(self._vectors),)
        width = len(self._vectors[0]) if self._vectors else 0
        return (len(self._vectors), width)


class NvidiaEmbeddingClient:
    """OpenAI-compatible embeddings client pointed at NVIDIA NIM."""

    def __init__(self):
        settings = get_settings()
        if not settings.nvidia_api_key:
            raise ValueError("Set NVIDIA_API_KEY in .env")

        self.model = settings.nvidia_embed_model
        self._client = OpenAI(
            api_key=settings.nvidia_api_key,
            base_url=settings.nvidia_base_url.rstrip("/"),
        )
        logger.info("Embeddings provider: nvidia  model: %s", self.model)

    def encode(
        self,
        texts,
        show_progress_bar: bool = False,
        batch_size: int = 16,
        convert_to_numpy: bool = False,
        input_type: str | None = None,
    ) -> EmbeddingResult:
        """Embed one string or a list of strings."""
        del show_progress_bar, convert_to_numpy
        single = isinstance(texts, str)
        items = [texts] if single else [str(item) for item in texts]
        if not items:
            return EmbeddingResult([], single=False)

        kind = input_type or ("query" if single else "passage")
        vectors: list[list[float]] = []
        for start in range(0, len(items), batch_size):
            batch = items[start:start + batch_size]
            response = self._client.embeddings.create(
                input=batch,
                model=self.model,
                encoding_format="float",
                extra_body={"input_type": kind, "truncate": "END"},
            )
            ordered = sorted(response.data, key=lambda row: row.index)
            vectors.extend(list(row.embedding) for row in ordered)

        if single:
            return EmbeddingResult(vectors[0], single=True)
        return EmbeddingResult(vectors, single=False)


@lru_cache(maxsize=1)
def get_embedding_model(model_name: str | None = None) -> NvidiaEmbeddingClient:
    """Return the shared NVIDIA embedding client."""
    del model_name
    return NvidiaEmbeddingClient()


def embed_passage(text: str) -> EmbeddingResult:
    """Embed a stored document with the NVIDIA API."""
    return get_embedding_model().encode(text, input_type="passage")
