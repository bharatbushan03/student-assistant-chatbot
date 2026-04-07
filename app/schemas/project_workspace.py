"""Schemas for project workspace APIs."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ProjectSettingsSchema(BaseModel):
    include_project_files: bool = True
    include_previous_chats: bool = False
    model: str = "default"
    temperature: float = Field(default=0.7, ge=0.0, le=1.2)


class ProjectCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default="", max_length=1000)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProjectUpdateSchema(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)
    metadata: Optional[Dict[str, Any]] = None
    settings: Optional[ProjectSettingsSchema] = None


class ShareProjectSchema(BaseModel):
    user_email: str = Field(..., min_length=5)


class ProjectResponseSchema(BaseModel):
    id: str
    name: str
    description: str
    metadata: Dict[str, Any]
    settings: ProjectSettingsSchema
    chat_count: int
    file_count: int
    created_at: datetime
    updated_at: datetime


class ProjectChatCreateSchema(BaseModel):
    title: str = Field(default="New Chat", min_length=1, max_length=200)


class ProjectChatUpdateSchema(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    is_pinned: Optional[bool] = None


class ProjectChatResponseSchema(BaseModel):
    id: str
    project_id: str
    title: str
    is_pinned: bool
    message_count: int
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime


class ProjectMessageCreateSchema(BaseModel):
    content: str = Field(..., min_length=1)
    file_ids: List[str] = Field(default_factory=list)
    use_project_files: Optional[bool] = None
    use_previous_chats: Optional[bool] = None


class ProjectMessageResponseSchema(BaseModel):
    id: str
    project_id: str
    chat_id: str
    role: str
    content: str
    file_ids: List[str] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


class ProjectMessagesResponseSchema(BaseModel):
    messages: List[ProjectMessageResponseSchema]
    has_more: bool
    next_cursor: Optional[str] = None


class ProjectFileResponseSchema(BaseModel):
    id: str
    project_id: str
    filename: str
    content_type: str
    size_bytes: int
    preview_text: str
    created_at: datetime


class ProjectSearchResultSchema(BaseModel):
    chat_id: str
    chat_title: str
    message_id: str
    snippet: str
    created_at: datetime


class ProjectSearchResponseSchema(BaseModel):
    query: str
    results: List[ProjectSearchResultSchema]
    count: int
