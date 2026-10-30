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
    nvidia_api_key: str | None = Field(default=None, alias="NVIDIA_API_KEY")
    pinecone_api_key: str | None = Field(default=None, alias="PINECONE_API_KEY")
    jwt_secret: str = Field(default="your_super_secret_jwt_key_here", alias="JWT_SECRET")

    # NVIDIA NIM — OpenAI-compatible chat API for Nemotron
    nvidia_base_url: str = Field(
        default="https://integrate.api.nvidia.com/v1",
        alias="NVIDIA_BASE_URL",
    )
    nvidia_model: str = Field(
        default="nvidia/nemotron-3-super-120b-a12b",
        alias="NVIDIA_MODEL",
    )

    # Optional first admin, created once when no admin account exists yet
    bootstrap_admin_email: str | None = Field(default=None, alias="BOOTSTRAP_ADMIN_EMAIL")
    bootstrap_admin_password: str | None = Field(default=None, alias="BOOTSTRAP_ADMIN_PASSWORD")
    bootstrap_admin_name: str = Field(default="MIET Administrator", alias="BOOTSTRAP_ADMIN_NAME")

    # Retrieval / storage
    processed_chunks_path: Path = PROJECT_ROOT / "data" / "processed" / "chunks.txt"
    num_context_chunks: int = 7  # Increased from 3 for better context coverage

    # Pinecone
    pinecone_index_name: str = Field(default="miet-jammu-index", alias="PINECONE_INDEX_NAME")
    pinecone_cloud: str = Field(default="aws", alias="PINECONE_CLOUD")
    pinecone_region: str = Field(default="us-east-1", alias="PINECONE_REGION")

    # Server
    port: int = Field(default=10000, alias="PORT")
    # Comma-separated browser origins, or * for any origin.
    # Example: https://miety-ai.vercel.app
    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")
    cors_allow_vercel_previews: bool = Field(default=True, alias="CORS_ALLOW_VERCEL_PREVIEWS")

    # MongoDB
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    mongodb_database: str = Field(default="miety_ai", alias="MONGODB_DATABASE")

    # Project workspace
    project_upload_max_mb: int = Field(default=10, alias="PROJECT_UPLOAD_MAX_MB")
    project_stream_rate_limit_per_min: int = Field(default=20, alias="PROJECT_STREAM_RATE_LIMIT_PER_MIN")
    project_upload_rate_limit_per_min: int = Field(default=30, alias="PROJECT_UPLOAD_RATE_LIMIT_PER_MIN")

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings instance so configuration is loaded once."""
    return Settings()
