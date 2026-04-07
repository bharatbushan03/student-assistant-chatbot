"""MongoDB models for group conversation system."""

from datetime import datetime
from typing import Optional
from bson import ObjectId


class GroupModel:
    """Group collection model."""

    collection_name = "groups"

    @staticmethod
    def from_dict(data: dict) -> dict:
        """Create a group document from dictionary."""
        now = datetime.utcnow()
        return {
            "name": data.get("name"),
            "description": data.get("description", ""),
            "avatar_url": data.get("avatar_url"),
            "created_by": data.get("created_by"),
            "is_ai_enabled": data.get("is_ai_enabled", True),
            "ai_auto_respond": data.get("ai_auto_respond", False),
            "created_at": data.get("created_at", now),
            "updated_at": data.get("updated_at", now),
        }


class GroupMemberModel:
    """Group member collection model."""

    collection_name = "group_members"

    ROLES = ["admin", "moderator", "member"]

    @staticmethod
    def from_dict(data: dict) -> dict:
        """Create a group member document from dictionary."""
        return {
            "group_id": data.get("group_id"),
            "user_id": data.get("user_id"),
            "role": data.get("role", "member"),
            "joined_at": data.get("joined_at", datetime.utcnow()),
        }


class GroupFileModel:
    """Group file attachment collection model."""

    collection_name = "group_files"

    @staticmethod
    def from_dict(data: dict) -> dict:
        """Create a group file document from dictionary."""
        now = datetime.utcnow()
        return {
            "group_id": data.get("group_id"),
            "uploaded_by": data.get("uploaded_by"),
            "filename": data.get("filename"),
            "stored_name": data.get("stored_name"),
            "storage_path": data.get("storage_path"),
            "content_type": data.get("content_type", "application/octet-stream"),
            "size_bytes": data.get("size_bytes", 0),
            "preview_text": data.get("preview_text", ""),
            "extracted_text": data.get("extracted_text", ""),
            "created_at": data.get("created_at", now),
            "updated_at": data.get("updated_at", now),
        }


class MessageModel:
    """Message collection model."""

    collection_name = "messages"

    MESSAGE_TYPES = ["text", "image", "file", "voice", "ai_response"]

    @staticmethod
    def from_dict(data: dict) -> dict:
        """Create a message document from dictionary."""
        now = datetime.utcnow()
        return {
            "group_id": data.get("group_id"),
            "sender_id": data.get("sender_id"),
            "sender_name": data.get("sender_name"),
            "sender_avatar": data.get("sender_avatar"),
            "content": data.get("content"),
            "message_type": data.get("message_type", "text"),
            "reply_to_id": data.get("reply_to_id"),
            "is_edited": data.get("is_edited", False),
            "edited_at": data.get("edited_at"),
            "metadata": data.get("metadata", {}),
            "created_at": data.get("created_at", now),
        }


class MessageStatusModel:
    """Message status collection model (embedded in messages for MongoDB)."""

    @staticmethod
    def from_dict(data: dict) -> dict:
        """Create a message status entry."""
        return {
            "user_id": data.get("user_id"),
            "status": data.get("status", "delivered"),
            "seen_at": data.get("seen_at"),
        }


class MessageReactionModel:
    """Message reaction collection model."""

    collection_name = "message_reactions"

    @staticmethod
    def from_dict(data: dict) -> dict:
        """Create a message reaction document."""
        return {
            "message_id": data.get("message_id"),
            "user_id": data.get("user_id"),
            "emoji": data.get("emoji"),
            "created_at": data.get("created_at", datetime.utcnow()),
        }


class AIContextModel:
    """AI context window collection model."""

    collection_name = "ai_context"

    @staticmethod
    def from_dict(data: dict) -> dict:
        """Create an AI context document."""
        return {
            "group_id": data.get("group_id"),
            "context_window": data.get("context_window", []),
            "last_updated": data.get("last_updated", datetime.utcnow()),
        }