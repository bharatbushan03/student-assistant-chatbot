"""Central application settings loaded from .env or environment variables."""

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve project root once – works in Docker, local dev, and Render
PROJECT_ROOT = Path(os.environ.get("PROJECT_ROOT", Path(__file__).resolve().parents[2]))


class Settings(BaseSettings):
    """Central application settings loaded from .env or environment variables."""

    # API keys
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    huggingface_api_token: str | None = Field(default=None, alias="HUGGINGFACEHUB_API_TOKEN")
    pinecone_api_key: str | None = Field(default=None, alias="PINECONE_API_KEY")
    jwt_secret: str = Field(default="your_super_secret_jwt_key_here", alias="JWT_SECRET")

    # Model configuration
    openai_model: str = "gpt-3.5-turbo"
    huggingface_model: str = "Qwen/Qwen2.5-72B-Instruct"

    # Retrieval / storage
    processed_chunks_path: Path = PROJECT_ROOT / "data" / "processed" / "chunks.txt"
    num_context_chunks: int = 7  # Increased from 3 for better context coverage

    # Pinecone
    pinecone_index_name: str = "miet-jammu-index"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"

    # Server
    port: int = Field(default=10000, alias="PORT")

    # MongoDB
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    mongodb_database: str = Field(default="miety_ai", alias="MONGODB_DATABASE")

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings instance so configuration is loaded once."""
    return Settings()
