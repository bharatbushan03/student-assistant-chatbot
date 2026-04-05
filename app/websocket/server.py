"""WebSocket server for real-time group messaging using Socket.IO."""

import logging
from typing import Dict, Set, Any, Optional
from datetime import datetime
import asyncio

from bson import ObjectId
from socketio import AsyncServer

from app.db.mongodb import get_database
from app.services.group_service import GroupService
from app.services.message_service import MessageService
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

# Create async Socket.IO server
sio = AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    ping_timeout=60,
    ping_interval=25,
)

# Track online users and typing status
online_users: Dict[str, Set[str]] = {}  # user_id -> set of session_ids
typing_users: Dict[str, Set[str]] = {}  # group_id -> set of user_ids typing


def _socket_safe(value: Any) -> Any:
    """Convert complex values into JSON-safe payloads for Socket.IO emits."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {key: _socket_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_socket_safe(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_socket_safe(item) for item in value)
    return value


async def resolve_user_identity(user_id: str, payload: dict) -> dict:
    """Resolve the sender identity from the token payload or database."""
    user_name = payload.get('name')
    user_avatar = payload.get('avatar_url') or payload.get('profile_picture')

    if user_name:
        return {
            'user_name': user_name,
            'user_avatar': user_avatar,
        }

    db = get_database()
    users_collection = db['users']

    try:
        user = await users_collection.find_one({'_id': ObjectId(user_id)})
    except Exception:
        user = await users_collection.find_one({'email': payload.get('email')})

    if user:
        return {
            'user_name': user.get('name') or user.get('email') or 'Student',
            'user_avatar': user.get('profile_picture') or user.get('avatar_url'),
        }

    email = payload.get('email')
    return {
        'user_name': email.split('@')[0] if isinstance(email, str) and '@' in email else 'Student',
        'user_avatar': None,
    }


@sio.event
async def connect(sid: str, environ: dict, auth: dict):
    """Handle new WebSocket connection."""
    try:
        # Authenticate user from token
        token = auth.get('token') if isinstance(auth, dict) else None
        if not token:
            logger.warning(f"Connection rejected: no token provided for sid={sid}")
            return False

        # Validate token
        try:
            from app.utils.auth import jwt
            from app.config.settings import get_settings

            settings = get_settings()
            payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])

            user_id = payload.get("id") or payload.get("_id")
            if not user_id:
                logger.warning(f"Connection rejected: invalid token payload for sid={sid}")
                return False
            user_id = str(user_id)

        except Exception as e:
            logger.warning(f"Connection rejected: invalid token for sid={sid}: {e}")
            return False

        user_identity = await resolve_user_identity(user_id, payload)

        # Store user session
        if user_id not in online_users:
            online_users[user_id] = set()
        online_users[user_id].add(sid)

        # Save user info in session
        await sio.save_session(sid, {
            'user_id': user_id,
            'user_name': user_identity['user_name'],
            'user_avatar': user_identity['user_avatar'],
        })

        logger.info(f"User {user_id} connected (sid={sid})")

        # Notify groups user is in about online status
        await broadcast_user_online(user_id)

        return True

    except Exception as e:
        logger.error(f"Connection error for sid={sid}: {e}")
        return False


@sio.event
async def disconnect(sid: str):
    """Handle WebSocket disconnection."""
    try:
        session = await sio.get_session(sid)
        user_id = session.get('user_id')

        if user_id:
            # Remove from online users
            if user_id in online_users:
                online_users[user_id].discard(sid)
                if not online_users[user_id]:
                    del online_users[user_id]

            # Clear typing status
            for group_id, typers in list(typing_users.items()):
                typing_users[group_id].discard(user_id)
                if not typing_users[group_id]:
                    del typing_users[group_id]

            # Notify groups user is offline
            await broadcast_user_offline(user_id)

        logger.info(f"User {user_id} disconnected (sid={sid})")

    except Exception as e:
        logger.error(f"Disconnect error for sid={sid}: {e}")


@sio.event
async def join_group(sid: str, data: dict):
    """Join a group room for real-time updates."""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    group_id = data.get('group_id')

    if not group_id:
        await sio.emit('error', {'code': 'INVALID_GROUP', 'message': 'Group ID required'}, to=sid)
        return

    # Verify membership
    is_member = await GroupService.is_member(group_id, user_id)
    if not is_member:
        await sio.emit('error', {'code': 'NOT_MEMBER', 'message': 'You are not a member of this group'}, to=sid)
        return

    # Join Socket.IO room
    await sio.enter_room(sid, f"group:{group_id}")

    # Notify group members
    await sio.emit('user_joined', {
        'group_id': group_id,
        'user_id': user_id,
        'user_name': session.get('user_name'),
    }, room=f"group:{group_id}")

    logger.info(f"User {user_id} joined group room {group_id}")


@sio.event
async def leave_group(sid: str, data: dict):
    """Leave a group room."""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    group_id = data.get('group_id')

    if group_id:
        await sio.leave_room(sid, f"group:{group_id}")

        await sio.emit('user_left', {
            'group_id': group_id,
            'user_id': user_id,
        }, room=f"group:{group_id}")

        logger.info(f"User {user_id} left group room {group_id}")


@sio.event
async def send_message(sid: str, data: dict):
    """Handle incoming message."""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    user_name = session.get('user_name')
    user_avatar = session.get('user_avatar')

    group_id = data.get('group_id')
    content = data.get('content')
    message_type = data.get('message_type', 'text')
    reply_to_id = data.get('reply_to_id')
    metadata = data.get('metadata', {})

    if not group_id or not content:
        await sio.emit('error', {'code': 'INVALID_MESSAGE', 'message': 'Group ID and content required'}, to=sid)
        return

    # Verify membership
    is_member = await GroupService.is_member(group_id, user_id)
    if not is_member:
        await sio.emit('error', {'code': 'NOT_MEMBER', 'message': 'You are not a member of this group'}, to=sid)
        return

    try:
        # Create message in database
        message = await MessageService.create_message(
            group_id=group_id,
            sender_id=user_id,
            sender_name=user_name,
            sender_avatar=user_avatar,
            content=content,
            message_type=message_type,
            reply_to_id=reply_to_id,
            metadata=metadata,
        )

        socket_message = _socket_safe(message)

        # Broadcast to group
        await sio.emit('message_created', {
            'message': socket_message,
            'group_id': group_id,
        }, room=f"group:{group_id}")

        # Update AI context
        await AIService.update_context(group_id, message)

        # Check if AI should respond
        group = await GroupService.get_group(group_id)
        is_reply_to_ai = False
        if reply_to_id:
            parent_msg = await MessageService.get_message(reply_to_id)
            if parent_msg and parent_msg.get('sender', {}).get('id') == AIService.AI_USER_ID:
                is_reply_to_ai = True

        if group and await AIService.should_respond(message, group, is_reply_to_ai):
            # Generate AI response in background
            asyncio.create_task(generate_and_send_ai_response(group_id, content, message))

        # Stop typing indicator
        if user_id in typing_users.get(group_id, set()):
            typing_users[group_id].discard(user_id)
            await sio.emit('typing', {
                'group_id': group_id,
                'user_id': user_id,
                'is_typing': False,
            }, room=f"group:{group_id}")

    except Exception:
        logger.exception("Error sending message")
        await sio.emit('error', {'code': 'SEND_FAILED', 'message': 'Failed to send message'}, to=sid)


async def generate_and_send_ai_response(group_id: str, user_message: str, trigger_message: dict):
    """Generate AI response and send to group."""
    try:
        # Small delay to feel natural
        await asyncio.sleep(1)

        # Get context and generate response
        context = await AIService.get_context(group_id)
        response_text = await AIService.generate_response(group_id, user_message, context)

        # Create AI message
        db = get_database()
        messages_collection = db["messages"]

        ai_message = {
            "group_id": group_id,
            "sender_id": AIService.AI_USER_ID,
            "sender_name": AIService.AI_USER_NAME,
            "sender_avatar": AIService.AI_USER_AVATAR,
            "content": response_text,
            "message_type": "ai_response",
            "reply_to_id": trigger_message.get("id"),
            "metadata": {"in_reply_to": trigger_message.get("sender_name")},
            "created_at": datetime.utcnow(),
            "status": [{"user_id": trigger_message.get("sender_id"), "status": "seen", "seen_at": datetime.utcnow()}],
        }

        result = await messages_collection.insert_one(ai_message)
        ai_message_id = str(result.inserted_id)

        # Format for broadcast
        ai_message_formatted = {
            "id": ai_message_id,
            "group_id": group_id,
            "sender": {
                "id": AIService.AI_USER_ID,
                "name": AIService.AI_USER_NAME,
                "avatar_url": AIService.AI_USER_AVATAR,
            },
            "content": response_text,
            "type": "ai_response",
            "reply_to": trigger_message.get("id"),
            "is_edited": False,
            "edited_at": None,
            "created_at": ai_message["created_at"],
            "metadata": ai_message["metadata"],
        }

        socket_ai_message = _socket_safe(ai_message_formatted)

        # Broadcast AI response
        await sio.emit('ai_response', {
            'message': socket_ai_message,
            'group_id': group_id,
        }, room=f"group:{group_id}")

        # Update AI context
        await AIService.update_context(group_id, ai_message)

        logger.info(f"AI response sent to group {group_id}")

    except Exception as e:
        logger.error(f"Error generating AI response: {e}")


@sio.event
async def typing_start(sid: str, data: dict):
    """Handle typing start event."""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    group_id = data.get('group_id')

    if not group_id:
        return

    if group_id not in typing_users:
        typing_users[group_id] = set()
    typing_users[group_id].add(user_id)

    await sio.emit('typing', {
        'group_id': group_id,
        'user_id': user_id,
        'is_typing': True,
    }, room=f"group:{group_id}")


@sio.event
async def typing_stop(sid: str, data: dict):
    """Handle typing stop event."""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    group_id = data.get('group_id')

    if not group_id:
        return

    if group_id in typing_users:
        typing_users[group_id].discard(user_id)

    await sio.emit('typing', {
        'group_id': group_id,
        'user_id': user_id,
        'is_typing': False,
    }, room=f"group:{group_id}")


@sio.event
async def mark_read(sid: str, data: dict):
    """Handle read receipt."""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    group_id = data.get('group_id')
    message_ids = data.get('message_ids', [])

    if not group_id or not message_ids:
        return

    for message_id in message_ids:
        await MessageService.mark_message_read(message_id, user_id)

    # Broadcast read status to group
    await sio.emit('messages_read', {
        'group_id': group_id,
        'user_id': user_id,
        'message_ids': message_ids,
    }, room=f"group:{group_id}")


@sio.event
async def add_reaction(sid: str, data: dict):
    """Handle adding a reaction to a message."""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    message_id = data.get('message_id')
    emoji = data.get('emoji')

    if not message_id or not emoji:
        await sio.emit('error', {'code': 'INVALID_REACTION', 'message': 'Message ID and emoji required'}, to=sid)
        return

    message = await MessageService.get_message(message_id)
    if not message:
        await sio.emit('error', {'code': 'MESSAGE_NOT_FOUND', 'message': 'Message not found'}, to=sid)
        return

    # Verify user is in the group
    is_member = await GroupService.is_member(message['group_id'], user_id)
    if not is_member:
        await sio.emit('error', {'code': 'NOT_MEMBER', 'message': 'You are not a member of this group'}, to=sid)
        return

    success = await MessageService.add_reaction(message_id, user_id, emoji)
    if not success:
        await sio.emit('error', {'code': 'REACTION_EXISTS', 'message': 'Reaction already exists'}, to=sid)
        return

    # Broadcast reaction
    await sio.emit('reaction_added', {
        'message_id': message_id,
        'emoji': emoji,
        'user_id': user_id,
        'user_name': session.get('user_name'),
    }, room=f"group:{message['group_id']}")


@sio.event
async def remove_reaction(sid: str, data: dict):
    """Handle removing a reaction from a message."""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    message_id = data.get('message_id')
    emoji = data.get('emoji')

    if not message_id or not emoji:
        return

    message = await MessageService.get_message(message_id)
    if not message:
        return

    await MessageService.remove_reaction(message_id, user_id, emoji)

    # Broadcast reaction removal
    await sio.emit('reaction_removed', {
        'message_id': message_id,
        'emoji': emoji,
        'user_id': user_id,
    }, room=f"group:{message['group_id']}")


# ── Helper Functions ─────────────────────────────────────────────────

async def broadcast_user_online(user_id: str):
    """Broadcast that a user is online to their groups."""
    # Get user's groups
    groups = await GroupService.get_user_groups(user_id)

    for group in groups:
        await sio.emit('user_online', {
            'user_id': user_id,
            'group_id': group['id'],
        }, room=f"group:{group['id']}")


async def broadcast_user_offline(user_id: str):
    """Broadcast that a user is offline to their groups."""
    groups = await GroupService.get_user_groups(user_id)

    for group in groups:
        await sio.emit('user_offline', {
            'user_id': user_id,
            'group_id': group['id'],
        }, room=f"group:{group['id']}")


# Create FastAPI-compatible Socket.IO handler
socketio_app = sio
