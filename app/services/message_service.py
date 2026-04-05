"""Message service layer for business logic and database operations."""

import inspect
from datetime import datetime
from typing import List, Optional, Dict, Any
from bson import ObjectId
from bson.errors import InvalidId

from app.db.mongodb import get_database
from app.models.group import MessageModel, MessageReactionModel, MessageStatusModel


def _to_object_id(value: Any) -> Optional[ObjectId]:
    """Convert a value to ObjectId when possible."""
    if isinstance(value, ObjectId):
        return value
    if value is None:
        return None
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError, ValueError):
        return None


def _message_id_filter(message_id: Any) -> Dict[str, Any]:
    """Build a safe query filter for message _id values."""
    object_id = _to_object_id(message_id)
    return {"_id": object_id if object_id is not None else message_id}


async def _ensure_cursor(cursor_or_awaitable: Any) -> Any:
    """Support both direct cursor returns and awaitable cursor mocks."""
    if inspect.isawaitable(cursor_or_awaitable):
        return await cursor_or_awaitable
    return cursor_or_awaitable


class MessageService:
    """Service class for message operations."""

    @staticmethod
    async def create_message(
        group_id: str,
        sender_id: str,
        sender_name: str,
        sender_avatar: Optional[str],
        content: str,
        message_type: str = "text",
        reply_to_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a new message in a group."""
        db = get_database()
        messages_collection = db[MessageModel.collection_name]

        message_data = MessageModel.from_dict({
            "group_id": group_id,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "sender_avatar": sender_avatar,
            "content": content,
            "message_type": message_type,
            "reply_to_id": reply_to_id,
            "metadata": metadata or {},
        })

        # Initialize status array with sender's status
        message_data["status"] = [
            {
                "user_id": sender_id,
                "status": "seen",
                "seen_at": datetime.utcnow(),
            }
        ]

        result = await messages_collection.insert_one(message_data)
        message_id = str(result.inserted_id)

        return await MessageService.get_message(message_id)

    @staticmethod
    async def get_message(message_id: str) -> Optional[Dict[str, Any]]:
        """Get a single message by ID."""
        db = get_database()
        messages_collection = db[MessageModel.collection_name]

        message = await messages_collection.find_one(_message_id_filter(message_id))
        if not message:
            return None

        formatted_message_id = str(message.get("_id", message_id))
        return MessageService._format_message(formatted_message_id, message)

    @staticmethod
    async def get_group_messages(
        group_id: str,
        limit: int = 50,
        before: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Get message history for a group with pagination."""
        db = get_database()
        messages_collection = db[MessageModel.collection_name]

        query = {"group_id": group_id}
        if before:
            query["created_at"] = {"$lt": before}

        cursor = await _ensure_cursor(messages_collection.find(query))
        cursor = await _ensure_cursor(cursor.sort("created_at", -1))
        cursor = await _ensure_cursor(cursor.limit(limit))
        messages = await cursor.to_list(length=None)

        # Format and reverse to get chronological order
        formatted = [
            MessageService._format_message(str(msg["_id"]), msg)
            for msg in messages
        ]
        return list(reversed(formatted))

    @staticmethod
    async def update_message(message_id: str, content: str) -> Optional[Dict[str, Any]]:
        """Update a message's content."""
        db = get_database()
        messages_collection = db[MessageModel.collection_name]

        result = await messages_collection.update_one(
            _message_id_filter(message_id),
            {
                "$set": {
                    "content": content,
                    "is_edited": True,
                    "edited_at": datetime.utcnow(),
                }
            }
        )

        if result.modified_count == 0:
            return None

        return await MessageService.get_message(message_id)

    @staticmethod
    async def delete_message(message_id: str) -> bool:
        """Delete a message."""
        db = get_database()
        messages_collection = db[MessageModel.collection_name]
        reactions_collection = db["message_reactions"]

        result = await messages_collection.delete_one(_message_id_filter(message_id))

        # Delete associated reactions
        await reactions_collection.delete_many({"message_id": message_id})

        return result.deleted_count > 0

    @staticmethod
    async def add_reaction(message_id: str, user_id: str, emoji: str) -> bool:
        """Add a reaction to a message."""
        db = get_database()
        reactions_collection = db[MessageReactionModel.collection_name]

        # Check if reaction already exists
        existing = await reactions_collection.find_one({
            "message_id": message_id,
            "user_id": user_id,
            "emoji": emoji,
        })

        if existing:
            return False

        reaction_data = MessageReactionModel.from_dict({
            "message_id": message_id,
            "user_id": user_id,
            "emoji": emoji,
        })

        await reactions_collection.insert_one(reaction_data)
        return True

    @staticmethod
    async def remove_reaction(message_id: str, user_id: str, emoji: str) -> bool:
        """Remove a reaction from a message."""
        db = get_database()
        reactions_collection = db[MessageReactionModel.collection_name]

        result = await reactions_collection.delete_one({
            "message_id": message_id,
            "user_id": user_id,
            "emoji": emoji,
        })

        return result.deleted_count > 0

    @staticmethod
    async def get_message_reactions(message_id: str) -> List[Dict[str, Any]]:
        """Get all reactions for a message, grouped by emoji."""
        db = get_database()
        reactions_collection = db[MessageReactionModel.collection_name]
        users_collection = db["users"]

        reactions = await reactions_collection.find(
            {"message_id": message_id}
        ).to_list(length=None)

        # Group by emoji
        emoji_groups: Dict[str, List[Dict]] = {}
        for reaction in reactions:
            emoji = reaction["emoji"]
            if emoji not in emoji_groups:
                emoji_groups[emoji] = []

            user = None
            user_object_id = _to_object_id(reaction.get("user_id"))
            if user_object_id is not None:
                user = await users_collection.find_one({"_id": user_object_id})
            emoji_groups[emoji].append({
                "user_id": reaction["user_id"],
                "name": user.get("name", "Unknown") if user else "Unknown",
            })

        # Format response
        result = []
        for emoji, users in emoji_groups.items():
            result.append({
                "emoji": emoji,
                "count": len(users),
                "users": [u["user_id"] for u in users],
                "user_names": [u["name"] for u in users],
            })

        return result

    @staticmethod
    async def mark_message_read(message_id: str, user_id: str) -> bool:
        """Mark a message as read for a user."""
        db = get_database()
        messages_collection = db[MessageModel.collection_name]

        result = await messages_collection.update_one(
            _message_id_filter(message_id),
            {
                "$set": {
                    "status.$[elem].status": "seen",
                    "status.$[elem].seen_at": datetime.utcnow(),
                },
                "$addToSet": {
                    "status": {
                        "user_id": user_id,
                        "status": "seen",
                        "seen_at": datetime.utcnow(),
                    }
                }
            },
            array_filters=[{"elem.user_id": user_id}],
            upsert=True,
        )

        return result.modified_count > 0 or result.upserted_id is not None

    @staticmethod
    async def get_message_status(message_id: str) -> List[Dict[str, Any]]:
        """Get the read status of a message for all users."""
        db = get_database()
        messages_collection = db[MessageModel.collection_name]

        message = await messages_collection.find_one(_message_id_filter(message_id))
        if not message:
            return []

        return message.get("status", [])

    @staticmethod
    async def search_messages(
        group_id: str,
        query: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Search for messages in a group by content."""
        db = get_database()
        messages_collection = db[MessageModel.collection_name]

        # Case-insensitive regex search
        cursor = await _ensure_cursor(messages_collection.find({
            "group_id": group_id,
            "content": {"$regex": query, "$options": "i"},
        }))
        cursor = await _ensure_cursor(cursor.sort("created_at", -1))
        cursor = await _ensure_cursor(cursor.limit(limit))

        messages = await cursor.to_list(length=None)

        return [
            MessageService._format_message(str(msg["_id"]), msg)
            for msg in messages
        ]

    @staticmethod
    def _format_message(message_id: str, message: dict) -> Dict[str, Any]:
        """Format a message document for API response."""
        return {
            "id": message_id,
            "group_id": message["group_id"],
            "sender": {
                "id": message.get("sender_id"),
                "name": message.get("sender_name", "Unknown"),
                "avatar_url": message.get("sender_avatar"),
            },
            "content": message["content"],
            "type": message.get("message_type", "text"),
            "reply_to": message.get("reply_to_id"),
            "is_edited": message.get("is_edited", False),
            "edited_at": message.get("edited_at"),
            "created_at": message["created_at"],
            "metadata": message.get("metadata", {}),
        }
