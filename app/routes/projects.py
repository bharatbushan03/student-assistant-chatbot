"""Project workspace routes: projects, chats, files, search, and streaming responses."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse, Response, StreamingResponse

from app.config.settings import get_settings
from app.schemas.project_workspace import (
    ProjectChatCreateSchema,
    ProjectChatResponseSchema,
    ProjectChatUpdateSchema,
    ProjectCreateSchema,
    ProjectFileResponseSchema,
    ProjectMessageCreateSchema,
    ProjectMessagesResponseSchema,
    ProjectResponseSchema,
    ProjectSearchResponseSchema,
    ProjectUpdateSchema,
    ShareProjectSchema,
)
from app.services.llm import get_llm_client
from app.services.project_workspace_service import ProjectWorkspaceService
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

_RATE_LIMIT_BUCKETS: Dict[str, List[float]] = {}


def _enforce_rate_limit(user_id: str, action: str, *, max_requests: int = 20, window_seconds: int = 60) -> None:
    now = time.time()
    key = f"{user_id}:{action}"
    timestamps = _RATE_LIMIT_BUCKETS.get(key, [])
    timestamps = [stamp for stamp in timestamps if (now - stamp) <= window_seconds]

    if len(timestamps) >= max_requests:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for {action}. Please wait before retrying.",
        )

    timestamps.append(now)
    _RATE_LIMIT_BUCKETS[key] = timestamps


def _chunk_text(text: str, chunk_size: int = 28) -> List[str]:
    if not text:
        return [""]
    return [text[index : index + chunk_size] for index in range(0, len(text), chunk_size)]


def _format_file_context(file_context: List[dict]) -> str:
    if not file_context:
        return ""

    parts = []
    for item in file_context:
        parts.append(
            "\n".join(
                [
                    f"[File: {item.get('filename', 'unknown')}]",
                    f"Relevance: {item.get('score', 0.0)}",
                    item.get("snippet", ""),
                ]
            )
        )
    return "\n\n".join(parts)


@router.post("", response_model=ProjectResponseSchema, status_code=201)
async def create_project(
    payload: ProjectCreateSchema,
    current_user: dict = Depends(get_current_user),
):
    project = await ProjectWorkspaceService.create_project(
        user_id=current_user["id"],
        name=payload.name.strip(),
        description=(payload.description or "").strip(),
        metadata=payload.metadata,
    )
    return project


@router.get("", response_model=List[ProjectResponseSchema])
async def list_projects(current_user: dict = Depends(get_current_user)):
    return await ProjectWorkspaceService.list_projects(current_user["id"])


@router.get("/{project_id}", response_model=ProjectResponseSchema)
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await ProjectWorkspaceService.get_project(project_id, current_user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectResponseSchema)
async def update_project(
    project_id: str,
    payload: ProjectUpdateSchema,
    current_user: dict = Depends(get_current_user),
):
    updates = payload.model_dump(exclude_unset=True)
    project = await ProjectWorkspaceService.update_project(project_id, current_user["id"], updates)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or not owned by current user")
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    success = await ProjectWorkspaceService.delete_project(project_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Project not found or not owned by current user")
    return None


@router.post("/{project_id}/share")
async def share_project(
    project_id: str,
    payload: ShareProjectSchema,
    current_user: dict = Depends(get_current_user),
):
    success = await ProjectWorkspaceService.share_project(
        project_id,
        current_user["id"],
        payload.user_email,
    )
    if not success:
        raise HTTPException(status_code=400, detail="Unable to share project. Check project ownership and user email.")
    return {"success": True, "message": "Project shared successfully."}


@router.post("/{project_id}/chats", response_model=ProjectChatResponseSchema, status_code=201)
async def create_chat(
    project_id: str,
    payload: ProjectChatCreateSchema,
    current_user: dict = Depends(get_current_user),
):
    chat = await ProjectWorkspaceService.create_chat(project_id, current_user["id"], payload.title.strip())
    if not chat:
        raise HTTPException(status_code=404, detail="Project not found")
    return chat


@router.get("/{project_id}/chats", response_model=List[ProjectChatResponseSchema])
async def list_chats(project_id: str, current_user: dict = Depends(get_current_user)):
    chats = await ProjectWorkspaceService.list_chats(project_id, current_user["id"])
    if chats is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return chats


@router.patch("/{project_id}/chats/{chat_id}", response_model=ProjectChatResponseSchema)
async def update_chat(
    project_id: str,
    chat_id: str,
    payload: ProjectChatUpdateSchema,
    current_user: dict = Depends(get_current_user),
):
    updates = payload.model_dump(exclude_unset=True)
    chat = await ProjectWorkspaceService.update_chat(project_id, chat_id, current_user["id"], updates)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.delete("/{project_id}/chats/{chat_id}", status_code=204)
async def delete_chat(
    project_id: str,
    chat_id: str,
    current_user: dict = Depends(get_current_user),
):
    success = await ProjectWorkspaceService.delete_chat(project_id, chat_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found")
    return None


@router.get("/{project_id}/chats/{chat_id}/messages", response_model=ProjectMessagesResponseSchema)
async def list_messages(
    project_id: str,
    chat_id: str,
    limit: int = Query(100, ge=1, le=200),
    before: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    before_dt = None
    if before:
        try:
            before_dt = datetime.fromisoformat(before.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid before timestamp") from exc

    messages = await ProjectWorkspaceService.get_messages(
        project_id,
        chat_id,
        current_user["id"],
        limit=limit,
        before=before_dt,
    )
    if messages is None:
        raise HTTPException(status_code=404, detail="Chat not found")

    has_more = len(messages) == limit
    next_cursor = messages[0]["created_at"].isoformat() if has_more and messages else None

    return {
        "messages": messages,
        "has_more": has_more,
        "next_cursor": next_cursor,
    }


@router.post("/{project_id}/chats/{chat_id}/messages/stream")
async def stream_message(
    project_id: str,
    chat_id: str,
    payload: ProjectMessageCreateSchema,
    current_user: dict = Depends(get_current_user),
):
    _enforce_rate_limit(
        current_user["id"],
        "project_chat_stream",
        max_requests=get_settings().project_stream_rate_limit_per_min,
        window_seconds=60,
    )

    project = await ProjectWorkspaceService.get_project(project_id, current_user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    chat = await ProjectWorkspaceService.get_chat(project_id, chat_id, current_user["id"])
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    recent_messages = await ProjectWorkspaceService.get_messages(
        project_id,
        chat_id,
        current_user["id"],
        limit=24,
    )
    if recent_messages is None:
        raise HTTPException(status_code=404, detail="Chat not found")

    include_project_files = (
        payload.use_project_files
        if payload.use_project_files is not None
        else project["settings"].get("include_project_files", True)
    )
    include_previous_chats = (
        payload.use_previous_chats
        if payload.use_previous_chats is not None
        else project["settings"].get("include_previous_chats", False)
    )

    user_message = await ProjectWorkspaceService.create_message(
        project_id,
        chat_id,
        current_user["id"],
        "user",
        payload.content,
        file_ids=payload.file_ids,
    )
    if not user_message:
        raise HTTPException(status_code=404, detail="Chat not found")

    file_context = []
    if include_project_files:
        file_context = await ProjectWorkspaceService.retrieve_file_context(
            project_id,
            current_user["id"],
            payload.content,
            limit=4,
            scoped_file_ids=payload.file_ids or None,
        )

    previous_chat_context = []
    if include_previous_chats:
        previous_chat_context = await ProjectWorkspaceService.retrieve_previous_chat_context(
            project_id,
            chat_id,
            current_user["id"],
            limit=8,
        )

    history_context = [
        {"role": message["role"], "content": message["content"]}
        for message in recent_messages[-12:]
        if message.get("content")
    ]

    file_context_text = _format_file_context(file_context)
    current_prompt = payload.content
    if file_context_text:
        current_prompt = (
            "Use the provided project file context when relevant.\n\n"
            f"Project File Context:\n{file_context_text}\n\n"
            f"User Question:\n{payload.content}"
        )

    llm_messages = [
        {
            "role": "system",
            "content": (
                "You are MIETY AI Project Assistant. "
                "Provide accurate answers using project context. "
                "If project file context is provided, prioritize it. "
                "Keep responses concise but actionable."
            ),
        }
    ]
    if previous_chat_context:
        llm_messages.extend(previous_chat_context)
    llm_messages.extend(history_context)
    llm_messages.append({"role": "user", "content": current_prompt})

    temperature = float(project["settings"].get("temperature", 0.7))

    try:
        assistant_text = await asyncio.to_thread(
            get_llm_client().generate,
            llm_messages,
            700,
            temperature,
        )
    except Exception as exc:
        logger.exception("Project workspace generation failed: %s", exc)
        raise HTTPException(status_code=503, detail="AI generation failed. Please retry in a moment.") from exc

    assistant_message = await ProjectWorkspaceService.create_message(
        project_id,
        chat_id,
        current_user["id"],
        "assistant",
        assistant_text,
        citations=file_context,
        metadata={"include_previous_chats": include_previous_chats},
    )

    await ProjectWorkspaceService.log_activity(
        user_id=current_user["id"],
        project_id=project_id,
        chat_id=chat_id,
        action="chat_response_streamed",
        metadata={
            "used_file_context": bool(file_context),
            "used_previous_chat_context": include_previous_chats,
            "input_length": len(payload.content),
        },
    )

    async def event_stream():
        start_payload = {
            "type": "start",
            "user_message": user_message,
        }
        yield f"data: {json.dumps(start_payload)}\n\n"

        for chunk in _chunk_text(assistant_text):
            token_payload = {
                "type": "token",
                "delta": chunk,
            }
            yield f"data: {json.dumps(token_payload)}\n\n"
            await asyncio.sleep(0.01)

        done_payload = {
            "type": "done",
            "assistant_message": assistant_message,
        }
        yield f"data: {json.dumps(done_payload)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{project_id}/files", response_model=List[ProjectFileResponseSchema])
async def list_files(project_id: str, current_user: dict = Depends(get_current_user)):
    files = await ProjectWorkspaceService.list_files(project_id, current_user["id"])
    if files is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return files


@router.post("/{project_id}/files", response_model=List[ProjectFileResponseSchema], status_code=201)
async def upload_files(
    project_id: str,
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    _enforce_rate_limit(
        current_user["id"],
        "project_file_upload",
        max_requests=get_settings().project_upload_rate_limit_per_min,
        window_seconds=60,
    )

    uploaded = []
    for upload in files:
        try:
            item = await ProjectWorkspaceService.upload_project_file(project_id, current_user["id"], upload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if not item:
            raise HTTPException(status_code=404, detail="Project not found")
        uploaded.append(item)

    return uploaded


@router.delete("/{project_id}/files/{file_id}", status_code=204)
async def delete_file(project_id: str, file_id: str, current_user: dict = Depends(get_current_user)):
    success = await ProjectWorkspaceService.delete_file(project_id, file_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return None


@router.get("/{project_id}/files/{file_id}/preview")
async def preview_file(project_id: str, file_id: str, current_user: dict = Depends(get_current_user)):
    file_doc = await ProjectWorkspaceService.get_file(project_id, file_id, current_user["id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    storage_path = file_doc.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="Stored file path not available")

    return FileResponse(
        storage_path,
        media_type=file_doc.get("content_type", "application/octet-stream"),
        filename=file_doc.get("filename", "file"),
    )


@router.get("/{project_id}/search", response_model=ProjectSearchResponseSchema)
async def search_project_messages(
    project_id: str,
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    results = await ProjectWorkspaceService.search_messages(project_id, current_user["id"], q, limit)
    if results is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "query": q,
        "results": results,
        "count": len(results),
    }


@router.get("/{project_id}/chats/{chat_id}/export")
async def export_chat(
    project_id: str,
    chat_id: str,
    format: str = Query("markdown", pattern="^(markdown|json|pdf)$"),
    current_user: dict = Depends(get_current_user),
):
    messages = await ProjectWorkspaceService.get_messages(project_id, chat_id, current_user["id"], limit=500)
    if messages is None:
        raise HTTPException(status_code=404, detail="Chat not found")

    if format == "json":
        payload = {
            "project_id": project_id,
            "chat_id": chat_id,
            "exported_at": datetime.utcnow().isoformat(),
            "messages": messages,
        }
        return PlainTextResponse(
            content=json.dumps(payload, default=str, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=chat-{chat_id}.json"},
        )

    if format == "pdf":
        markdown_for_pdf = await ProjectWorkspaceService.export_chat_markdown(project_id, chat_id, current_user["id"])
        if markdown_for_pdf is None:
            raise HTTPException(status_code=404, detail="Chat not found")

        try:
            from fpdf import FPDF
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail="PDF export dependency is missing. Install fpdf2 to enable this feature.",
            ) from exc

        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=12)
        pdf.add_page()
        pdf.set_font("Helvetica", size=11)

        for line in markdown_for_pdf.splitlines():
            safe_line = line.encode("latin-1", "replace").decode("latin-1")
            pdf.multi_cell(0, 6, safe_line)

        pdf_bytes = bytes(pdf.output(dest="S"))

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=chat-{chat_id}.pdf"},
        )

    markdown = await ProjectWorkspaceService.export_chat_markdown(project_id, chat_id, current_user["id"])
    if markdown is None:
        raise HTTPException(status_code=404, detail="Chat not found")

    return PlainTextResponse(
        content=markdown,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=chat-{chat_id}.md"},
    )
