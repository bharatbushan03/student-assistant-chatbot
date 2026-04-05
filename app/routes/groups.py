"""Group management REST API routes."""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from app.utils.auth import get_current_user
from app.schemas.group import (
    GroupCreate,
    GroupUpdate,
    GroupResponse,
    GroupDetailResponse,
    AddMemberSchema,
    ChangeRoleSchema,
    MemberResponse,
    AIConfigureSchema,
    AISummarizeRequest,
    AISummarizeResponse,
    AIContextResponse,
    ErrorResponse,
)
from app.services.group_service import GroupService
from app.services.ai_service import AIService
from app.services.message_service import MessageService
from app.db.mongodb import get_database

logger = logging.getLogger(__name__)

router = APIRouter()


class AddFriendByEmailRequest(BaseModel):
    """Simple payload for adding a group member by email."""
    email: str = Field(..., min_length=5)


# ── Group CRUD ───────────────────────────────────────────────────────

@router.post("", response_model=GroupResponse, status_code=201)
async def create_group(
    group_data: GroupCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new group. The creator becomes admin automatically."""
    try:
        group = await GroupService.create_group(
            name=group_data.name,
            created_by=current_user["id"],
            description=group_data.description,
            avatar_url=group_data.avatar_url,
            is_ai_enabled=group_data.is_ai_enabled,
            ai_auto_respond=group_data.ai_auto_respond,
            initial_members=group_data.member_ids,
        )
        return group
    except Exception as e:
        logger.exception("Failed to create group: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create group")


@router.get("", response_model=List[GroupResponse])
async def list_user_groups(current_user: dict = Depends(get_current_user)):
    """Get all groups the current user belongs to."""
    try:
        groups = await GroupService.get_user_groups(current_user["id"])
        return groups
    except Exception as e:
        logger.exception("Failed to list groups: %s", e)
        raise HTTPException(status_code=500, detail="Failed to list groups")


@router.get("/{group_id}", response_model=GroupDetailResponse)
async def get_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get details of a specific group."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    group = await GroupService.get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Get members
    members = await GroupService.get_group_members(group_id)
    group["members"] = members

    return group


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str,
    updates: GroupUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update group details. Admin only."""
    # Check admin permission
    has_permission = await GroupService.has_permission(
        current_user["id"], group_id, "admin"
    )
    if not has_permission:
        raise HTTPException(status_code=403, detail="Only admins can update group settings")

    update_dict = updates.model_dump(exclude_unset=True)
    group = await GroupService.update_group(group_id, update_dict)

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    return group


@router.delete("/{group_id}", status_code=204)
async def delete_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a group. Admin only."""
    # Check admin permission
    has_permission = await GroupService.has_permission(
        current_user["id"], group_id, "admin"
    )
    if not has_permission:
        raise HTTPException(status_code=403, detail="Only admins can delete the group")

    success = await GroupService.delete_group(group_id)
    if not success:
        raise HTTPException(status_code=404, detail="Group not found")

    return None


# ── Member Management ────────────────────────────────────────────────

@router.get("/{group_id}/members", response_model=List[MemberResponse])
async def list_members(
    group_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get all members of a group."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    members = await GroupService.get_group_members(group_id)
    return members


@router.post("/{group_id}/members", status_code=201)
async def add_members(
    group_id: str,
    member_data: AddMemberSchema,
    current_user: dict = Depends(get_current_user),
):
    """Add members to a group. Admin/Moderator only."""
    # Check permission (admin or moderator)
    has_permission = await GroupService.has_permission(
        current_user["id"], group_id, "moderator"
    )
    if not has_permission:
        raise HTTPException(status_code=403, detail="Insufficient permissions to add members")

    added = []
    for user_id in member_data.user_ids:
        success = await GroupService.add_member(group_id, user_id, member_data.role)
        if success:
            added.append(user_id)

    return {"added": added, "count": len(added)}


@router.post("/{group_id}/members/by-email", status_code=201)
async def add_member_by_email(
    group_id: str,
    friend_data: AddFriendByEmailRequest,
    current_user: dict = Depends(get_current_user),
):
    """Add a member using their email address. Admin/Moderator only."""
    has_permission = await GroupService.has_permission(
        current_user["id"], group_id, "moderator"
    )
    if not has_permission:
        raise HTTPException(status_code=403, detail="Insufficient permissions to add members")

    email = friend_data.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    db = get_database()
    users_collection = db["users"]

    user = await users_collection.find_one({"email": email}, {"_id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="No user found with this email")

    user_id = str(user["_id"])
    success = await GroupService.add_member(group_id, user_id, "member")

    if not success:
        raise HTTPException(status_code=400, detail="User is already a member of this group")

    return {"added": [user_id], "count": 1}


@router.delete("/{group_id}/members/{user_id}", status_code=204)
async def remove_member(
    group_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a member from a group. Admin/Moderator only."""
    # Check permission
    has_permission = await GroupService.has_permission(
        current_user["id"], group_id, "moderator"
    )
    if not has_permission:
        raise HTTPException(status_code=403, detail="Insufficient permissions to remove members")

    # Can't remove yourself this way
    if user_id == current_user["id"]:
        raise HTTPException(
            status_code=400,
            detail="Use the leave endpoint to remove yourself from the group"
        )

    success = await GroupService.remove_member(group_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Member not found")

    return None


@router.put("/{group_id}/members/{user_id}/role")
async def change_member_role(
    group_id: str,
    user_id: str,
    role_data: ChangeRoleSchema,
    current_user: dict = Depends(get_current_user),
):
    """Change a member's role. Admin only."""
    # Check admin permission
    has_permission = await GroupService.has_permission(
        current_user["id"], group_id, "admin"
    )
    if not has_permission:
        raise HTTPException(status_code=403, detail="Only admins can change member roles")

    success = await GroupService.change_member_role(group_id, user_id, role_data.role)
    if not success:
        raise HTTPException(status_code=404, detail="Member not found")

    return {"message": "Role updated successfully"}


@router.post("/{group_id}/leave", status_code=204)
async def leave_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Leave a group."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=404, detail="You are not a member of this group")

    # Check if user is the last admin
    user_role = await GroupService.get_user_role_in_group(current_user["id"], group_id)
    if user_role == "admin":
        admins = [m for m in await GroupService.get_group_members(group_id) if m["role"] == "admin"]
        if len(admins) == 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot leave: you are the only admin. Transfer ownership first or delete the group."
            )

    await GroupService.remove_member(group_id, current_user["id"])
    return None


# ── AI Configuration ─────────────────────────────────────────────────

@router.post("/{group_id}/ai/configure")
async def configure_ai(
    group_id: str,
    config: AIConfigureSchema,
    current_user: dict = Depends(get_current_user),
):
    """Configure AI behavior for a group. Admin only."""
    # Check admin permission
    has_permission = await GroupService.has_permission(
        current_user["id"], group_id, "admin"
    )
    if not has_permission:
        raise HTTPException(status_code=403, detail="Only admins can configure AI settings")

    update_dict = {}
    if config.is_ai_enabled is not None:
        update_dict["is_ai_enabled"] = config.is_ai_enabled
    if config.ai_auto_respond is not None:
        update_dict["ai_auto_respond"] = config.ai_auto_respond

    if not update_dict:
        raise HTTPException(status_code=400, detail="No configuration changes provided")

    group = await GroupService.update_group(group_id, update_dict)
    return {"message": "AI configuration updated", "group": group}


@router.post("/{group_id}/ai/summarize", response_model=AISummarizeResponse)
async def summarize_conversation(
    group_id: str,
    request: AISummarizeRequest,
    current_user: dict = Depends(get_current_user),
):
    """Get AI summary of recent conversation."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    summary = await AIService.summarize_conversation(group_id, request.message_count)
    return summary


@router.get("/{group_id}/ai/context", response_model=AIContextResponse)
async def get_ai_context(
    group_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get the current AI context window for a group."""
    # Check membership
    is_member = await GroupService.is_member(group_id, current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    db = get_database()
    ai_context_collection = db["ai_context"]

    context_doc = await ai_context_collection.find_one({"group_id": group_id})

    if not context_doc:
        return {
            "group_id": group_id,
            "context_messages": [],
            "last_updated": None,
        }

    return {
        "group_id": group_id,
        "context_messages": context_doc.get("context_window", []),
        "last_updated": context_doc.get("last_updated"),
    }
