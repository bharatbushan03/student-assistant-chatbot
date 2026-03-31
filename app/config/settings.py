
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
	"""Central application settings loaded from .env or environment variables."""

	# API keys
	openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
	huggingface_api_token: str | None = Field(default=None, alias="HUGGINGFACEHUB_API_TOKEN")

	# Model configuration
	openai_model: str = "gpt-3.5-turbo"
	huggingface_model: str = "mistralai/Mistral-7B-Instruct-v0.2"

	# Retrieval / storage
	chroma_collection: str = "miet_jammu_collection"
	chroma_persist_path: Path = Path(__file__).resolve().parents[2] / "data" / "embeddings" / "chroma_db"
	processed_chunks_path: Path = Path(__file__).resolve().parents[2] / "data" / "processed" / "chunks.txt"
	num_context_chunks: int = 3

	model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
	"""Cached settings instance so configuration is loaded once."""
	return Settings()
