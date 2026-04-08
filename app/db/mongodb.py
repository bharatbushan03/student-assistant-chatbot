"""MongoDB async connection and database access using Motor."""

from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import logging

from app.config.settings import get_settings

logger = logging.getLogger(__name__)

# Global client instance for connection pooling
_client: Optional[AsyncIOMotorClient] = None


def get_client() -> AsyncIOMotorClient:
    """Get or create the MongoDB async client with connection pooling.

    Motor automatically handles connection pooling with:
    - maxPoolSize: 100 (default)
    - minPoolSize: 10 (default)
    - maxIdleTimeMS: 120000 (default)

    These defaults are suitable for most production workloads.
    """
    global _client
    if _client is None:
        settings = get_settings()
        _client = AsyncIOMotorClient(
            settings.mongodb_uri,
            maxPoolSize=100,
            minPoolSize=10,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
        )
        logger.info("MongoDB client initialized with connection pooling")
    return _client


def get_database():
    """Get the database instance from the client."""
    settings = get_settings()
    client = get_client()
    return client[settings.mongodb_database]


async def close_client():
    """Close the MongoDB client connection on shutdown."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("MongoDB client connection closed")


# ── Collection helpers ──────────────────────────────────────────────


def get_users_collection():
    """Get the users collection for database operations."""
    db = get_database()
    return db["users"]


def get_student_academics_collection():
    """Get the student academics collection for results and analytics."""
    db = get_database()
    return db["student_academics"]
