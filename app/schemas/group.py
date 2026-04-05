"""Pydantic schemas for group conversation API validation."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class RoleEnum(str, Enum):
    """User roles in a group."""
    ADMIN = "admin"
    MODERATOR = "moderator"
    MEMBER = "member"


class MessageTypeEnum(str, Enum):
    """Message types."""
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    VOICE = "voice"
    AI_RESPONSE = "ai_response"


class MessageStatusEnum(str, Enum):
    """Message delivery status."""
    SENT = "sent"
    DELIVERED = "delivered"
    SEEN = "seen"


# ── Group Schemas ────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    """Schema for creating a new group."""
    name: str = Field(..., min_length=1, max_length=100, description="Group name (required)")
    description: Optional[str] = Field(None, max_length=500, description="Group description (optional)")
    avatar_url: Optional[str] = Field(None, description="Group avatar URL (optional)")
    member_ids: List[str] = Field(default_factory=list, description="Initial member user IDs")
    is_ai_enabled: bool = Field(True, description="Enable AI participant")
    ai_auto_respond: bool = Field(False, description="Enable AI auto-response mode")


class GroupUpdate(BaseModel):
    """Schema for updating a group."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None
    is_ai_enabled: Optional[bool] = None
    ai_auto_respond: Optional[bool] = None


class GroupMemberSchema(BaseModel):
    """Schema for a group member."""
    user_id: str
    role: RoleEnum
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GroupResponse(BaseModel):
    """Schema for group response."""
    id: str
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    created_by: str
    is_ai_enabled: bool
    ai_auto_respond: bool
    member_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GroupDetailResponse(GroupResponse):
    """Extended group response with members."""
    members: List[GroupMemberSchema] = Field(default_factory=list)


# ── Message Schemas ──────────────────────────────────────────────────

class MessageCreate(BaseModel):
    """Schema for creating a new message."""
    content: str = Field(..., min_length=1, description="Message content")
    message_type: MessageTypeEnum = Field(MessageTypeEnum.TEXT, description="Message type")
    reply_to_id: Optional[str] = Field(None, description="ID of message being replied to")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata (file URLs, etc.)")


class MessageUpdate(BaseModel):
    """Schema for updating a message."""
    content: str = Field(..., min_length=1, description="Updated message content")


class UserSchema(BaseModel):
    """Schema for user information in messages."""
    id: str
    name: str
    avatar_url: Optional[str] = None


class ReactionSchema(BaseModel):
    """Schema for message reaction."""
    emoji: str
    count: int
    users: List[str]  # User IDs who reacted


class MessageResponse(BaseModel):
    """Schema for message response."""
    id: str
    group_id: str
    sender: UserSchema
    content: str
    type: MessageTypeEnum
    reply_to: Optional[str] = None
    reactions: List[ReactionSchema] = Field(default_factory=list)
    is_edited: bool = False
    edited_at: Optional[datetime] = None
    created_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class MessageHistoryResponse(BaseModel):
    """Schema for paginated message history response."""
    messages: List[MessageResponse]
    has_more: bool
    next_cursor: Optional[str] = None


# ── Member Management Schemas ───────────────────────────────────────

class AddMemberSchema(BaseModel):
    """Schema for adding members to a group."""
    user_ids: List[str] = Field(..., min_length=1, description="User IDs to add")
    role: RoleEnum = Field(RoleEnum.MEMBER, description="Role to assign")


class RemoveMemberSchema(BaseModel):
    """Schema for removing a member from a group."""
    user_id: str = Field(..., description="User ID to remove")


class ChangeRoleSchema(BaseModel):
    """Schema for changing a member's role."""
    role: RoleEnum = Field(..., description="New role to assign")


class MemberResponse(BaseModel):
    """Schema for member response."""
    user_id: str
    name: str
    avatar_url: Optional[str] = None
    role: RoleEnum
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── AI Schemas ──────────────────────────────────────────────────────

class AIConfigureSchema(BaseModel):
    """Schema for configuring AI behavior in a group."""
    is_ai_enabled: Optional[bool] = None
    ai_auto_respond: Optional[bool] = None
    auto_respond_triggers: Optional[List[str]] = Field(None, description="Keywords that trigger auto-response")


class AISummarizeRequest(BaseModel):
    """Schema for requesting AI conversation summary."""
    message_count: int = Field(20, ge=5, le=100, description="Number of messages to summarize")


class AISummarizeResponse(BaseModel):
    """Schema for AI summary response."""
    summary: str
    key_points: List[str] = Field(default_factory=list)
    generated_at: datetime


class AIContextResponse(BaseModel):
    """Schema for AI context window response."""
    group_id: str
    context_messages: List[Dict[str, Any]]
    last_updated: Optional[datetime] = None


# ── WebSocket Event Schemas ─────────────────────────────────────────

class WebSocketMessage(BaseModel):
    """Schema for WebSocket message events."""
    group_id: str
    content: str
    message_type: MessageTypeEnum = MessageTypeEnum.TEXT
    reply_to_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WebSocketTypingEvent(BaseModel):
    """Schema for typing indicator events."""
    group_id: str
    is_typing: bool


class WebSocketReadReceipt(BaseModel):
    """Schema for read receipt events."""
    group_id: str
    message_ids: List[str]


class WebSocketReactionEvent(BaseModel):
    """Schema for reaction events."""
    message_id: str
    emoji: str


# ── Error Response Schemas ──────────────────────────────────────────

class ErrorResponse(BaseModel):
    """Schema for error responses."""
    detail: str
    error_code: Optional[str] = None


class ValidationErrorDetail(BaseModel):
    """Schema for validation error details."""
    loc: List[str]
    msg: str
    type: str


class ValidationErrorResponse(BaseModel):
    """Schema for validation error responses."""
    detail: List[ValidationErrorDetail]
