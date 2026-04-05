"""Message REST API routes for history and management."""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime

from app.utils.auth import get_current_user
from app.schemas.group import (
    MessageCreate,
    MessageResponse,
    MessageUpdate,
    MessageHistoryResponse,
    ErrorResponse,
    WebSocketReactionEvent,
)
from app.services.message_service import MessageService
from app.services.group_service import GroupService
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

router = APIRouter()


def _assert_message_belongs_to_group(message: dict, group_id: str) -> None:
    """Reject operations when the message does not belong to the route's group."""
    if message.get("group_id") != group_id:
        # Return 404 to avoid leaking cross-group message existence.
        raise HTTPException(status_code=404, detail="Message not found")


# ── Message History ──────────────────────────────────────────────────

@router.get("/{group_id}/messages", response_model=MessageHistoryResponse)
async def get_message_history(
    group_id: str,
    limit: int = Query(50, ge=1, le=100, description="Number of messages to retrieve"),
    before: Optional[str] = Query(None, description="ISO timestamp for pagination"),
    current_user: dict = Depends(get_current_user),
):
    """Get message history for a group with pagination."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    before_dt = None
    if before:
        try:
            before_dt = datetime.fromisoformat(before.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid 'before' timestamp format")

    messages = await MessageService.get_group_messages(group_id, limit, before_dt)

    # Check if there are more messages
    has_more = len(messages) == limit

    # Get cursor for next page (timestamp of oldest message)
    next_cursor = None
    if has_more and messages:
        next_cursor = messages[0]["created_at"].isoformat()

    return {
        "messages": messages,
        "has_more": has_more,
        "next_cursor": next_cursor,
    }


# ── Individual Message Operations ────────────────────────────────────

@router.get("/{group_id}/messages/{message_id}", response_model=MessageResponse)
async def get_message(
    group_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific message by ID."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    message = await MessageService.get_message(message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    _assert_message_belongs_to_group(message, group_id)

    return message


@router.put("/{group_id}/messages/{message_id}", response_model=MessageResponse)
async def edit_message(
    group_id: str,
    message_id: str,
    update_data: MessageUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Edit a message. Only sender or admin can edit."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    message = await MessageService.get_message(message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    _assert_message_belongs_to_group(message, group_id)

    # Check permission (sender or admin/moderator)
    is_sender = message["sender"]["id"] == current_user["id"]
    has_permission = await GroupService.has_permission(
        current_user["id"], group_id, "moderator"
    )

    if not is_sender and not has_permission:
        raise HTTPException(
            status_code=403,
            detail="Only the sender or a moderator can edit this message"
        )

    updated = await MessageService.update_message(message_id, update_data.content)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update message")

    return updated


@router.delete("/{group_id}/messages/{message_id}", status_code=204)
async def delete_message(
    group_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a message. Only sender or admin can delete."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    message = await MessageService.get_message(message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    _assert_message_belongs_to_group(message, group_id)

    # Check permission (sender or admin/moderator)
    is_sender = message["sender"]["id"] == current_user["id"]
    has_permission = await GroupService.has_permission(
        current_user["id"], group_id, "moderator"
    )

    if not is_sender and not has_permission:
        raise HTTPException(
            status_code=403,
            detail="Only the sender or a moderator can delete this message"
        )

    success = await MessageService.delete_message(message_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete message")

    return None


# ── Message Reactions ────────────────────────────────────────────────

@router.post("/{group_id}/messages/{message_id}/reactions", status_code=201)
async def add_reaction(
    group_id: str,
    message_id: str,
    reaction: WebSocketReactionEvent,
    current_user: dict = Depends(get_current_user),
):
    """Add a reaction to a message."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    message = await MessageService.get_message(message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    _assert_message_belongs_to_group(message, group_id)

    success = await MessageService.add_reaction(message_id, current_user["id"], reaction.emoji)
    if not success:
        raise HTTPException(status_code=400, detail="Reaction already exists")

    # Get updated reactions
    reactions = await MessageService.get_message_reactions(message_id)
    return {"message_id": message_id, "reactions": reactions}


@router.delete("/{group_id}/messages/{message_id}/reactions/{emoji}", status_code=204)
async def remove_reaction(
    group_id: str,
    message_id: str,
    emoji: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a reaction from a message."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    message = await MessageService.get_message(message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    _assert_message_belongs_to_group(message, group_id)

    success = await MessageService.remove_reaction(message_id, current_user["id"], emoji)
    if not success:
        # Return 204 even if reaction didn't exist (idempotent)
        pass

    return None


@router.get("/{group_id}/messages/{message_id}/reactions")
async def get_reactions(
    group_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get all reactions for a message."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    message = await MessageService.get_message(message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    _assert_message_belongs_to_group(message, group_id)

    reactions = await MessageService.get_message_reactions(message_id)
    return {"message_id": message_id, "reactions": reactions}


# ── Search ───────────────────────────────────────────────────────────

@router.get("/{group_id}/search")
async def search_messages(
    group_id: str,
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """Search messages in a group by content."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    messages = await MessageService.search_messages(group_id, q, limit)
    return {"query": q, "messages": messages, "count": len(messages)}
