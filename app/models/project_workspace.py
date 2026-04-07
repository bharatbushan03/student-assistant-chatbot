"""MongoDB document factories for project workspace entities."""

from datetime import datetime


class ProjectModel:
    """Project container model."""

    collection_name = "projects"

    @staticmethod
    def from_dict(data: dict) -> dict:
        now = datetime.utcnow()
        return {
            "name": data.get("name"),
            "description": data.get("description", ""),
            "owner_id": data.get("owner_id"),
            "metadata": data.get("metadata", {}),
            "settings": data.get(
                "settings",
                {
                    "include_project_files": True,
                    "include_previous_chats": False,
                    "model": "default",
                    "temperature": 0.7,
                },
            ),
            "shared_user_ids": data.get("shared_user_ids", []),
            "created_at": data.get("created_at", now),
            "updated_at": data.get("updated_at", now),
        }


class ProjectChatModel:
    """Chat thread model bound to a project."""

    collection_name = "project_chats"

    @staticmethod
    def from_dict(data: dict) -> dict:
        now = datetime.utcnow()
        return {
            "project_id": data.get("project_id"),
            "owner_id": data.get("owner_id"),
            "title": data.get("title", "New Chat"),
            "is_pinned": data.get("is_pinned", False),
            "created_at": data.get("created_at", now),
            "updated_at": data.get("updated_at", now),
            "last_message_at": data.get("last_message_at", now),
        }


class ProjectMessageModel:
    """Message model for project chat conversations."""

    collection_name = "project_messages"

    @staticmethod
    def from_dict(data: dict) -> dict:
        return {
            "project_id": data.get("project_id"),
            "chat_id": data.get("chat_id"),
            "user_id": data.get("user_id"),
            "role": data.get("role", "user"),
            "content": data.get("content", ""),
            "file_ids": data.get("file_ids", []),
            "citations": data.get("citations", []),
            "metadata": data.get("metadata", {}),
            "created_at": data.get("created_at", datetime.utcnow()),
        }


class ProjectFileModel:
    """Uploaded file model for project-level context."""

    collection_name = "project_files"

    @staticmethod
    def from_dict(data: dict) -> dict:
        return {
            "project_id": data.get("project_id"),
            "user_id": data.get("user_id"),
            "filename": data.get("filename"),
            "stored_name": data.get("stored_name"),
            "storage_path": data.get("storage_path"),
            "content_type": data.get("content_type"),
            "size_bytes": data.get("size_bytes", 0),
            "preview_text": data.get("preview_text", ""),
            "extracted_text": data.get("extracted_text", ""),
            "embedding": data.get("embedding", []),
            "created_at": data.get("created_at", datetime.utcnow()),
            "updated_at": data.get("updated_at", datetime.utcnow()),
        }


class ProjectActivityLogModel:
    """Audit log model for project actions."""

    collection_name = "project_activity_logs"

    @staticmethod
    def from_dict(data: dict) -> dict:
        return {
            "project_id": data.get("project_id"),
            "chat_id": data.get("chat_id"),
            "user_id": data.get("user_id"),
            "action": data.get("action"),
            "metadata": data.get("metadata", {}),
            "created_at": data.get("created_at", datetime.utcnow()),
        }