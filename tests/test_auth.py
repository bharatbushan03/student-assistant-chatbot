"""Tests for auth endpoint resilience during MongoDB outages."""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from pymongo.errors import ServerSelectionTimeoutError

from app.main import fastapi_app

client = TestClient(fastapi_app)


def test_login_returns_503_when_mongodb_unavailable():
    """Login should fail gracefully with 503 when MongoDB is unreachable."""
    users_collection = AsyncMock()
    users_collection.find_one.side_effect = ServerSelectionTimeoutError("MongoDB unavailable")

    with patch("app.routes.auth.get_users_collection", return_value=users_collection):
        response = client.post(
            "/auth/login",
            json={"email": "student@mietjammu.in", "password": "password123"},
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "Database service is temporarily unavailable. Please try again shortly."
