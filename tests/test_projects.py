"""Tests for project workspace routes."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import fastapi_app
from app.utils.auth import get_current_user

client = TestClient(fastapi_app)


def override_get_current_user():
    return {"id": "test-user", "email": "test@mietjammu.in"}


def test_create_project_endpoint():
    project_response = {
        "id": "project-1",
        "name": "Capstone",
        "description": "Final year project",
        "metadata": {},
        "settings": {
            "include_project_files": True,
            "include_previous_chats": False,
            "model": "default",
            "temperature": 0.7,
        },
        "chat_count": 0,
        "file_count": 0,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        with patch(
            "app.routes.projects.ProjectWorkspaceService.create_project",
            new=AsyncMock(return_value=project_response),
        ):
            response = client.post(
                "/api/projects",
                json={"name": "Capstone", "description": "Final year project", "metadata": {}},
            )
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["name"] == "Capstone"


def test_list_projects_endpoint():
    projects = [
        {
            "id": "project-1",
            "name": "Capstone",
            "description": "Final year project",
            "metadata": {},
            "settings": {
                "include_project_files": True,
                "include_previous_chats": False,
                "model": "default",
                "temperature": 0.7,
            },
            "chat_count": 2,
            "file_count": 1,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
    ]

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        with patch(
            "app.routes.projects.ProjectWorkspaceService.list_projects",
            new=AsyncMock(return_value=projects),
        ):
            response = client.get("/api/projects")
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["chat_count"] == 2


def test_upload_project_file_endpoint():
    file_response = {
        "id": "file-1",
        "project_id": "project-1",
        "filename": "notes.txt",
        "content_type": "text/plain",
        "size_bytes": 12,
        "preview_text": "hello world",
        "created_at": datetime.utcnow().isoformat(),
    }

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        with patch(
            "app.routes.projects.ProjectWorkspaceService.upload_project_file",
            new=AsyncMock(return_value=file_response),
        ):
            response = client.post(
                "/api/projects/project-1/files",
                files=[("files", ("notes.txt", b"hello world", "text/plain"))],
            )
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()[0]["filename"] == "notes.txt"


def test_stream_message_endpoint_contract():
    project = {
        "id": "project-1",
        "settings": {
            "include_project_files": True,
            "include_previous_chats": False,
            "model": "default",
            "temperature": 0.7,
        },
    }
    chat = {
        "id": "chat-1",
        "project_id": "project-1",
        "title": "New Chat",
        "is_pinned": False,
        "message_count": 0,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "last_message_at": datetime.utcnow().isoformat(),
    }
    user_message = {
        "id": "msg-user-1",
        "project_id": "project-1",
        "chat_id": "chat-1",
        "role": "user",
        "content": "hello",
        "file_ids": [],
        "citations": [],
        "created_at": datetime.utcnow().isoformat(),
    }
    assistant_message = {
        "id": "msg-ai-1",
        "project_id": "project-1",
        "chat_id": "chat-1",
        "role": "assistant",
        "content": "Hello from assistant",
        "file_ids": [],
        "citations": [],
        "created_at": datetime.utcnow().isoformat(),
    }

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        with patch("app.routes.projects.ProjectWorkspaceService.get_project", new=AsyncMock(return_value=project)), \
             patch("app.routes.projects.ProjectWorkspaceService.get_chat", new=AsyncMock(return_value=chat)), \
             patch("app.routes.projects.ProjectWorkspaceService.get_messages", new=AsyncMock(return_value=[])), \
             patch("app.routes.projects.ProjectWorkspaceService.retrieve_file_context", new=AsyncMock(return_value=[])), \
             patch("app.routes.projects.ProjectWorkspaceService.retrieve_previous_chat_context", new=AsyncMock(return_value=[])), \
             patch("app.routes.projects.ProjectWorkspaceService.log_activity", new=AsyncMock(return_value=None)), \
             patch("app.routes.projects.ProjectWorkspaceService.create_message", new=AsyncMock(side_effect=[user_message, assistant_message])), \
             patch("app.routes.projects.get_llm_client") as mock_get_llm_client:
            mock_get_llm_client.return_value.generate.return_value = "Hello from assistant"

            response = client.post(
                "/api/projects/project-1/chats/chat-1/messages/stream",
                json={"content": "hello", "file_ids": []},
            )
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 200
    assert '"type": "start"' in response.text
    assert '"type": "token"' in response.text
    assert '"type": "done"' in response.text