"""Tests for the /chat/ask endpoint."""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import fastapi_app

client = TestClient(fastapi_app)

# Mock user for testing
MOCK_USER = {"id": "test-user", "email": "test@mietjammu.in"}


def override_get_current_user():
    """Override dependency to return mock user."""
    return MOCK_USER


def test_ask_question_returns_answer():
    """Mock the RAG pipeline and verify the endpoint returns an answer."""
    # Override auth dependency
    from app.routes.chat import get_current_user
    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        with patch("app.routes.chat.answer_query", return_value="test-answer"):
            response = client.post("/chat/ask", json={"question": "Hello there?"})

        assert response.status_code == 200
        assert response.json()["answer"] == "test-answer"
    finally:
        fastapi_app.dependency_overrides.clear()


def test_ask_question_requires_payload():
    """Sending an empty body should return 422."""
    from app.routes.chat import get_current_user
    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        response = client.post("/chat/ask", json={})
        assert response.status_code == 422
    finally:
        fastapi_app.dependency_overrides.clear()


def test_ask_question_minimum_length():
    """Question shorter than 3 chars should be rejected."""
    from app.routes.chat import get_current_user
    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        response = client.post("/chat/ask", json={"question": "Hi"})
        assert response.status_code == 422
    finally:
        fastapi_app.dependency_overrides.clear()


def test_ask_question_runtime_error_returns_503():
    """Runtime errors from the RAG/LLM layer should surface as 503."""
    from app.routes.chat import get_current_user
    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        with patch("app.routes.chat.answer_query", side_effect=RuntimeError("OpenAI quota is exhausted")):
            response = client.post("/chat/ask", json={"question": "Explain attendance policy"})

        assert response.status_code == 503
        assert "quota" in response.json()["detail"].lower()
    finally:
        fastapi_app.dependency_overrides.clear()


def test_health_check():
    """Health endpoint should return 200."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_openapi_schema_generates():
    """OpenAPI should generate successfully for the mounted routes."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "/auth/signup" in schema["paths"]
    assert "/api/groups/{group_id}" in schema["paths"]
    assert "/api/groups/{group_id}/messages" in schema["paths"]


def test_root_serves_html():
    """Root / should return the frontend HTML."""
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
