"""Tests for the /chat/ask endpoint."""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_ask_question_returns_answer():
    """Mock the RAG pipeline and verify the endpoint returns an answer."""
    with patch("app.routes.chat.answer_query", return_value="test-answer"):
        response = client.post("/chat/ask", json={"question": "Hello there?"})

    assert response.status_code == 200
    assert response.json()["answer"] == "test-answer"


def test_ask_question_requires_payload():
    """Sending an empty body should return 422."""
    response = client.post("/chat/ask", json={})
    assert response.status_code == 422


def test_ask_question_minimum_length():
    """Question shorter than 3 chars should be rejected."""
    response = client.post("/chat/ask", json={"question": "Hi"})
    assert response.status_code == 422


def test_health_check():
    """Health endpoint should return 200."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_root_serves_html():
    """Root / should return the frontend HTML."""
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
