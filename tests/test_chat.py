from fastapi.testclient import TestClient

from app.main import app
from app.routes import chat as chat_route


client = TestClient(app)


def test_ask_question_returns_answer(monkeypatch):
	monkeypatch.setattr(chat_route, "answer_query", lambda _: "test-answer")

	response = client.post("/chat/ask", json={"question": "Hello?"})

	assert response.status_code == 200
	assert response.json()["answer"] == "test-answer"


def test_ask_question_requires_payload():
	response = client.post("/chat/ask", json={})

	assert response.status_code == 422
