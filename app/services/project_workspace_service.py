"""Service layer for project workspace features."""

from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import math
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import UploadFile
from pypdf import PdfReader

from app.config.settings import PROJECT_ROOT, get_settings
from app.db.mongodb import get_database
from app.models.project_workspace import (
    ProjectActivityLogModel,
    ProjectChatModel,
    ProjectFileModel,
    ProjectMessageModel,
    ProjectModel,
)
from app.services.embeddings import get_embedding_model

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".json",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
}

UPLOAD_ROOT = PROJECT_ROOT / "data" / "project_uploads"


def _to_object_id(value: Any) -> Optional[ObjectId]:
    if isinstance(value, ObjectId):
        return value
    if value is None:
        return None
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError, ValueError):
        return None


def _safe_filename(name: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return sanitized.strip("._") or "file"


def _cosine_similarity(left: List[float], right: List[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0

    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))

    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0

    return dot / (left_norm * right_norm)


def _serialize_project(document: dict, chat_count: int, file_count: int) -> dict:
    return {
        "id": str(document["_id"]),
        "name": document.get("name", "Untitled Project"),
        "description": document.get("description", ""),
        "metadata": document.get("metadata", {}),
        "settings": document.get(
            "settings",
            {
                "include_project_files": True,
                "include_previous_chats": False,
                "model": "default",
                "temperature": 0.7,
            },
        ),
        "chat_count": chat_count,
        "file_count": file_count,
        "created_at": document.get("created_at"),
        "updated_at": document.get("updated_at"),
    }


def _serialize_chat(document: dict, message_count: int) -> dict:
    return {
        "id": str(document["_id"]),
        "project_id": document.get("project_id"),
        "title": document.get("title", "New Chat"),
        "is_pinned": document.get("is_pinned", False),
        "message_count": message_count,
        "created_at": document.get("created_at"),
        "updated_at": document.get("updated_at"),
        "last_message_at": document.get("last_message_at") or document.get("updated_at"),
    }


def _serialize_message(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "project_id": document.get("project_id"),
        "chat_id": document.get("chat_id"),
        "role": document.get("role", "assistant"),
        "content": document.get("content", ""),
        "file_ids": document.get("file_ids", []),
        "citations": document.get("citations", []),
        "created_at": document.get("created_at"),
    }


def _serialize_file(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "project_id": document.get("project_id"),
        "filename": document.get("filename", "file"),
        "content_type": document.get("content_type", "application/octet-stream"),
        "size_bytes": document.get("size_bytes", 0),
        "preview_text": document.get("preview_text", ""),
        "created_at": document.get("created_at"),
    }


def _extract_text_from_content(filename: str, content_type: str, payload: bytes) -> str:
    extension = Path(filename).suffix.lower()

    if extension == ".pdf":
        reader = PdfReader(io.BytesIO(payload))
        chunks = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(chunk.strip() for chunk in chunks if chunk.strip())

    if extension == ".txt":
        return payload.decode("utf-8", errors="ignore")

    if extension == ".json":
        try:
            parsed = json.loads(payload.decode("utf-8", errors="ignore"))
            return json.dumps(parsed, indent=2)[:12000]
        except Exception:
            return payload.decode("utf-8", errors="ignore")[:12000]

    if extension == ".csv":
        text = payload.decode("utf-8", errors="ignore")
        reader = csv.reader(io.StringIO(text))
        rows = []
        for index, row in enumerate(reader):
            rows.append(", ".join(row))
            if index >= 200:
                break
        return "\n".join(rows)

    if extension in {".png", ".jpg", ".jpeg", ".webp", ".gif"} or content_type.startswith("image/"):
        return f"Image file uploaded: {filename}. Use this file as visual reference in project context."

    return payload.decode("utf-8", errors="ignore")[:12000]


def _split_for_snippet(text: str, limit: int = 500) -> str:
    if not text:
        return ""
    cleaned = " ".join(text.split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[:limit].rstrip()}..."


class ProjectWorkspaceService:
    """Business logic for project workspaces."""

    @staticmethod
    def _collections() -> Dict[str, Any]:
        db = get_database()
        return {
            "projects": db[ProjectModel.collection_name],
            "chats": db[ProjectChatModel.collection_name],
            "messages": db[ProjectMessageModel.collection_name],
            "files": db[ProjectFileModel.collection_name],
            "logs": db[ProjectActivityLogModel.collection_name],
            "users": db["users"],
        }

    @staticmethod
    async def _get_project_for_user(project_id: str, user_id: str) -> Optional[dict]:
        collections = ProjectWorkspaceService._collections()
        object_id = _to_object_id(project_id)
        if object_id is None:
            return None

        return await collections["projects"].find_one(
            {
                "_id": object_id,
                "$or": [
                    {"owner_id": user_id},
                    {"shared_user_ids": user_id},
                ],
            }
        )

    @staticmethod
    async def _get_owned_project(project_id: str, user_id: str) -> Optional[dict]:
        collections = ProjectWorkspaceService._collections()
        object_id = _to_object_id(project_id)
        if object_id is None:
            return None
        return await collections["projects"].find_one({"_id": object_id, "owner_id": user_id})

    @staticmethod
    async def log_activity(
        *,
        user_id: str,
        action: str,
        project_id: Optional[str] = None,
        chat_id: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> None:
        collections = ProjectWorkspaceService._collections()
        payload = ProjectActivityLogModel.from_dict(
            {
                "project_id": project_id,
                "chat_id": chat_id,
                "user_id": user_id,
                "action": action,
                "metadata": metadata or {},
            }
        )
        await collections["logs"].insert_one(payload)

    @staticmethod
    async def create_project(user_id: str, name: str, description: str, metadata: dict) -> dict:
        collections = ProjectWorkspaceService._collections()
        project_doc = ProjectModel.from_dict(
            {
                "name": name,
                "description": description,
                "owner_id": user_id,
                "metadata": metadata,
            }
        )
        result = await collections["projects"].insert_one(project_doc)
        created = await collections["projects"].find_one({"_id": result.inserted_id})

        await ProjectWorkspaceService.log_activity(
            user_id=user_id,
            project_id=str(result.inserted_id),
            action="project_created",
            metadata={"name": name},
        )

        return _serialize_project(created, chat_count=0, file_count=0)

    @staticmethod
    async def list_projects(user_id: str) -> List[dict]:
        collections = ProjectWorkspaceService._collections()
        docs = await collections["projects"].find(
            {
                "$or": [
                    {"owner_id": user_id},
                    {"shared_user_ids": user_id},
                ]
            }
        ).sort("updated_at", -1).to_list(length=None)

        results = []
        for doc in docs:
            project_id = str(doc["_id"])
            chat_count = await collections["chats"].count_documents({"project_id": project_id})
            file_count = await collections["files"].count_documents({"project_id": project_id})
            results.append(_serialize_project(doc, chat_count=chat_count, file_count=file_count))

        return results

    @staticmethod
    async def get_project(project_id: str, user_id: str) -> Optional[dict]:
        collections = ProjectWorkspaceService._collections()
        doc = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not doc:
            return None
        project_id_text = str(doc["_id"])
        chat_count = await collections["chats"].count_documents({"project_id": project_id_text})
        file_count = await collections["files"].count_documents({"project_id": project_id_text})
        return _serialize_project(doc, chat_count=chat_count, file_count=file_count)

    @staticmethod
    async def update_project(project_id: str, user_id: str, updates: dict) -> Optional[dict]:
        collections = ProjectWorkspaceService._collections()
        existing = await ProjectWorkspaceService._get_owned_project(project_id, user_id)
        if not existing:
            return None

        update_payload = {**updates, "updated_at": datetime.utcnow()}
        await collections["projects"].update_one(
            {"_id": existing["_id"]},
            {"$set": update_payload},
        )

        updated = await collections["projects"].find_one({"_id": existing["_id"]})
        project_id_text = str(updated["_id"])
        chat_count = await collections["chats"].count_documents({"project_id": project_id_text})
        file_count = await collections["files"].count_documents({"project_id": project_id_text})

        await ProjectWorkspaceService.log_activity(
            user_id=user_id,
            project_id=project_id_text,
            action="project_updated",
            metadata={"fields": sorted(update_payload.keys())},
        )

        return _serialize_project(updated, chat_count=chat_count, file_count=file_count)

    @staticmethod
    async def delete_project(project_id: str, user_id: str) -> bool:
        collections = ProjectWorkspaceService._collections()
        existing = await ProjectWorkspaceService._get_owned_project(project_id, user_id)
        if not existing:
            return False

        project_id_text = str(existing["_id"])

        files = await collections["files"].find({"project_id": project_id_text}).to_list(length=None)
        for file_doc in files:
            storage_path = file_doc.get("storage_path")
            if storage_path:
                try:
                    path = Path(storage_path)
                    if path.exists():
                        path.unlink()
                except Exception:
                    logger.warning("Failed to remove project file at %s", storage_path)

        upload_dir = UPLOAD_ROOT / project_id_text
        if upload_dir.exists():
            shutil.rmtree(upload_dir, ignore_errors=True)

        await collections["projects"].delete_one({"_id": existing["_id"]})
        await collections["chats"].delete_many({"project_id": project_id_text})
        await collections["messages"].delete_many({"project_id": project_id_text})
        await collections["files"].delete_many({"project_id": project_id_text})
        await collections["logs"].delete_many({"project_id": project_id_text})

        await ProjectWorkspaceService.log_activity(
            user_id=user_id,
            project_id=project_id_text,
            action="project_deleted",
        )
        return True

    @staticmethod
    async def share_project(project_id: str, owner_id: str, user_email: str) -> bool:
        collections = ProjectWorkspaceService._collections()
        existing = await ProjectWorkspaceService._get_owned_project(project_id, owner_id)
        if not existing:
            return False

        user = await collections["users"].find_one({"email": user_email.lower().strip()})
        if not user:
            return False

        shared_user_id = str(user["_id"])
        await collections["projects"].update_one(
            {"_id": existing["_id"]},
            {
                "$addToSet": {"shared_user_ids": shared_user_id},
                "$set": {"updated_at": datetime.utcnow()},
            },
        )

        await ProjectWorkspaceService.log_activity(
            user_id=owner_id,
            project_id=str(existing["_id"]),
            action="project_shared",
            metadata={"shared_with": shared_user_id},
        )
        return True

    @staticmethod
    async def create_chat(project_id: str, user_id: str, title: str) -> Optional[dict]:
        collections = ProjectWorkspaceService._collections()
        project = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not project:
            return None

        project_id_text = str(project["_id"])
        chat_doc = ProjectChatModel.from_dict(
            {
                "project_id": project_id_text,
                "owner_id": user_id,
                "title": title,
            }
        )
        result = await collections["chats"].insert_one(chat_doc)
        created = await collections["chats"].find_one({"_id": result.inserted_id})

        await collections["projects"].update_one(
            {"_id": project["_id"]},
            {"$set": {"updated_at": datetime.utcnow()}},
        )

        await ProjectWorkspaceService.log_activity(
            user_id=user_id,
            project_id=project_id_text,
            chat_id=str(result.inserted_id),
            action="chat_created",
        )

        return _serialize_chat(created, message_count=0)

    @staticmethod
    async def list_chats(project_id: str, user_id: str) -> Optional[List[dict]]:
        collections = ProjectWorkspaceService._collections()
        project = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not project:
            return None

        project_id_text = str(project["_id"])
        docs = await collections["chats"].find({"project_id": project_id_text}).sort(
            [("is_pinned", -1), ("updated_at", -1)]
        ).to_list(length=None)

        serialized = []
        for doc in docs:
            chat_id = str(doc["_id"])
            message_count = await collections["messages"].count_documents(
                {"project_id": project_id_text, "chat_id": chat_id}
            )
            serialized.append(_serialize_chat(doc, message_count=message_count))

        return serialized

    @staticmethod
    async def get_chat(project_id: str, chat_id: str, user_id: str) -> Optional[dict]:
        collections = ProjectWorkspaceService._collections()
        project = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not project:
            return None

        chat_object_id = _to_object_id(chat_id)
        if chat_object_id is None:
            return None

        project_id_text = str(project["_id"])
        chat_doc = await collections["chats"].find_one(
            {"_id": chat_object_id, "project_id": project_id_text}
        )
        if not chat_doc:
            return None

        message_count = await collections["messages"].count_documents(
            {"project_id": project_id_text, "chat_id": str(chat_doc["_id"])}
        )
        return _serialize_chat(chat_doc, message_count=message_count)

    @staticmethod
    async def update_chat(project_id: str, chat_id: str, user_id: str, updates: dict) -> Optional[dict]:
        collections = ProjectWorkspaceService._collections()
        project = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not project:
            return None

        chat_object_id = _to_object_id(chat_id)
        if chat_object_id is None:
            return None

        project_id_text = str(project["_id"])
        update_payload = {**updates, "updated_at": datetime.utcnow()}
        result = await collections["chats"].update_one(
            {"_id": chat_object_id, "project_id": project_id_text},
            {"$set": update_payload},
        )
        if result.matched_count == 0:
            return None

        chat_doc = await collections["chats"].find_one({"_id": chat_object_id})
        message_count = await collections["messages"].count_documents(
            {"project_id": project_id_text, "chat_id": str(chat_object_id)}
        )

        await ProjectWorkspaceService.log_activity(
            user_id=user_id,
            project_id=project_id_text,
            chat_id=str(chat_object_id),
            action="chat_updated",
            metadata={"fields": sorted(update_payload.keys())},
        )

        return _serialize_chat(chat_doc, message_count=message_count)

    @staticmethod
    async def delete_chat(project_id: str, chat_id: str, user_id: str) -> bool:
        collections = ProjectWorkspaceService._collections()
        project = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not project:
            return False

        chat_object_id = _to_object_id(chat_id)
        if chat_object_id is None:
            return False

        project_id_text = str(project["_id"])
        result = await collections["chats"].delete_one(
            {"_id": chat_object_id, "project_id": project_id_text}
        )
        if result.deleted_count == 0:
            return False

        await collections["messages"].delete_many({"project_id": project_id_text, "chat_id": str(chat_object_id)})

        await ProjectWorkspaceService.log_activity(
            user_id=user_id,
            project_id=project_id_text,
            chat_id=str(chat_object_id),
            action="chat_deleted",
        )
        return True

    @staticmethod
    async def get_messages(
        project_id: str,
        chat_id: str,
        user_id: str,
        *,
        limit: int = 100,
        before: Optional[datetime] = None,
    ) -> Optional[List[dict]]:
        collections = ProjectWorkspaceService._collections()
        chat = await ProjectWorkspaceService.get_chat(project_id, chat_id, user_id)
        if not chat:
            return None

        query: Dict[str, Any] = {
            "project_id": project_id,
            "chat_id": chat_id,
        }
        if before:
            query["created_at"] = {"$lt": before}

        docs = await collections["messages"].find(query).sort("created_at", -1).limit(limit).to_list(length=limit)
        docs.reverse()
        return [_serialize_message(doc) for doc in docs]

    @staticmethod
    async def create_message(
        project_id: str,
        chat_id: str,
        user_id: str,
        role: str,
        content: str,
        *,
        file_ids: Optional[List[str]] = None,
        citations: Optional[List[dict]] = None,
        metadata: Optional[dict] = None,
    ) -> Optional[dict]:
        collections = ProjectWorkspaceService._collections()
        chat = await ProjectWorkspaceService.get_chat(project_id, chat_id, user_id)
        if not chat:
            return None

        message_doc = ProjectMessageModel.from_dict(
            {
                "project_id": project_id,
                "chat_id": chat_id,
                "user_id": user_id,
                "role": role,
                "content": content,
                "file_ids": file_ids or [],
                "citations": citations or [],
                "metadata": metadata or {},
                "created_at": datetime.utcnow(),
            }
        )
        result = await collections["messages"].insert_one(message_doc)
        created = await collections["messages"].find_one({"_id": result.inserted_id})

        chat_object_id = _to_object_id(chat_id)
        if chat_object_id is not None:
            update_payload: Dict[str, Any] = {
                "updated_at": datetime.utcnow(),
                "last_message_at": datetime.utcnow(),
            }

            if role == "user":
                current_chat = await collections["chats"].find_one({"_id": chat_object_id})
                if current_chat:
                    current_title = current_chat.get("title", "").strip().lower()
                    if current_title in {"", "new chat"}:
                        update_payload["title"] = content[:60].strip() or "New Chat"

            await collections["chats"].update_one(
                {"_id": chat_object_id, "project_id": project_id},
                {"$set": update_payload},
            )

        return _serialize_message(created)

    @staticmethod
    async def upload_project_file(project_id: str, user_id: str, upload: UploadFile) -> Optional[dict]:
        project = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not project:
            return None

        filename = upload.filename or "file"
        extension = Path(filename).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise ValueError("Unsupported file type. Allowed: PDF, TXT, JSON, CSV, and common images.")

        payload = await upload.read()
        max_file_size_bytes = get_settings().project_upload_max_mb * 1024 * 1024
        if not payload:
            raise ValueError("Uploaded file is empty.")
        if len(payload) > max_file_size_bytes:
            raise ValueError(
                f"File too large. Maximum upload size is {get_settings().project_upload_max_mb}MB."
            )

        project_id_text = str(project["_id"])
        project_dir = UPLOAD_ROOT / project_id_text
        project_dir.mkdir(parents=True, exist_ok=True)

        safe_name = _safe_filename(filename)
        stored_name = f"{uuid4().hex}_{safe_name}"
        storage_path = project_dir / stored_name
        await asyncio.to_thread(storage_path.write_bytes, payload)

        extracted_text = _extract_text_from_content(filename, upload.content_type or "", payload)
        preview_text = _split_for_snippet(extracted_text, limit=300)

        embedding: List[float] = []
        if extracted_text.strip():
            vector = await asyncio.to_thread(get_embedding_model().encode, extracted_text[:8000])
            embedding = vector.tolist() if hasattr(vector, "tolist") else list(vector)

        collections = ProjectWorkspaceService._collections()
        file_doc = ProjectFileModel.from_dict(
            {
                "project_id": project_id_text,
                "user_id": user_id,
                "filename": filename,
                "stored_name": stored_name,
                "storage_path": str(storage_path),
                "content_type": upload.content_type or "application/octet-stream",
                "size_bytes": len(payload),
                "preview_text": preview_text,
                "extracted_text": extracted_text[:50000],
                "embedding": embedding,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        )
        result = await collections["files"].insert_one(file_doc)
        created = await collections["files"].find_one({"_id": result.inserted_id})

        await collections["projects"].update_one(
            {"_id": project["_id"]},
            {"$set": {"updated_at": datetime.utcnow()}},
        )

        await ProjectWorkspaceService.log_activity(
            user_id=user_id,
            project_id=project_id_text,
            action="file_uploaded",
            metadata={"filename": filename, "size_bytes": len(payload)},
        )

        return _serialize_file(created)

    @staticmethod
    async def list_files(project_id: str, user_id: str) -> Optional[List[dict]]:
        project = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not project:
            return None

        project_id_text = str(project["_id"])
        collections = ProjectWorkspaceService._collections()
        docs = await collections["files"].find({"project_id": project_id_text}).sort("created_at", -1).to_list(length=None)
        return [_serialize_file(doc) for doc in docs]

    @staticmethod
    async def get_file(project_id: str, file_id: str, user_id: str) -> Optional[dict]:
        project = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not project:
            return None

        file_object_id = _to_object_id(file_id)
        if file_object_id is None:
            return None

        project_id_text = str(project["_id"])
        collections = ProjectWorkspaceService._collections()
        return await collections["files"].find_one({"_id": file_object_id, "project_id": project_id_text})

    @staticmethod
    async def delete_file(project_id: str, file_id: str, user_id: str) -> bool:
        file_doc = await ProjectWorkspaceService.get_file(project_id, file_id, user_id)
        if not file_doc:
            return False

        if file_doc.get("user_id") != user_id:
            project = await ProjectWorkspaceService._get_owned_project(project_id, user_id)
            if not project:
                return False

        collections = ProjectWorkspaceService._collections()
        await collections["files"].delete_one({"_id": file_doc["_id"]})
        path = Path(file_doc.get("storage_path", ""))
        if path.exists():
            path.unlink()

        await ProjectWorkspaceService.log_activity(
            user_id=user_id,
            project_id=project_id,
            action="file_deleted",
            metadata={"file_id": str(file_doc["_id"]), "filename": file_doc.get("filename")},
        )
        return True

    @staticmethod
    async def retrieve_file_context(
        project_id: str,
        user_id: str,
        query: str,
        *,
        limit: int = 4,
        scoped_file_ids: Optional[List[str]] = None,
    ) -> List[dict]:
        project = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not project:
            return []

        collections = ProjectWorkspaceService._collections()
        query_filter: Dict[str, Any] = {
            "project_id": str(project["_id"]),
            "extracted_text": {"$ne": ""},
        }

        if scoped_file_ids:
            object_ids = [_to_object_id(file_id) for file_id in scoped_file_ids]
            object_ids = [object_id for object_id in object_ids if object_id is not None]
            if object_ids:
                query_filter["_id"] = {"$in": object_ids}

        docs = await collections["files"].find(query_filter).to_list(length=None)
        if not docs:
            return []

        query_vector_raw = await asyncio.to_thread(get_embedding_model().encode, query)
        query_vector = query_vector_raw.tolist() if hasattr(query_vector_raw, "tolist") else list(query_vector_raw)

        scored = []
        for doc in docs:
            embedding = doc.get("embedding") or []
            score = _cosine_similarity(query_vector, embedding)
            scored.append((score, doc))

        scored.sort(key=lambda item: item[0], reverse=True)
        top = scored[:limit]

        context = []
        for score, doc in top:
            context.append(
                {
                    "file_id": str(doc["_id"]),
                    "filename": doc.get("filename"),
                    "score": round(float(score), 4),
                    "snippet": _split_for_snippet(doc.get("extracted_text", ""), limit=500),
                }
            )
        return context

    @staticmethod
    async def retrieve_previous_chat_context(
        project_id: str,
        chat_id: str,
        user_id: str,
        *,
        limit: int = 8,
    ) -> List[dict]:
        project = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not project:
            return []

        collections = ProjectWorkspaceService._collections()
        docs = await collections["messages"].find(
            {
                "project_id": str(project["_id"]),
                "chat_id": {"$ne": chat_id},
            }
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        docs.reverse()

        context = []
        for doc in docs:
            role = doc.get("role", "assistant")
            content = doc.get("content", "")
            if content.strip():
                context.append({"role": role, "content": content})
        return context

    @staticmethod
    async def search_messages(project_id: str, user_id: str, query: str, limit: int = 20) -> Optional[List[dict]]:
        project = await ProjectWorkspaceService._get_project_for_user(project_id, user_id)
        if not project:
            return None

        collections = ProjectWorkspaceService._collections()
        project_id_text = str(project["_id"])
        escaped = re.escape(query.strip())

        message_docs = await collections["messages"].find(
            {
                "project_id": project_id_text,
                "content": {"$regex": escaped, "$options": "i"},
            }
        ).sort("created_at", -1).limit(limit).to_list(length=limit)

        chat_ids = list({doc.get("chat_id") for doc in message_docs if doc.get("chat_id")})
        chat_object_ids = [_to_object_id(chat_id) for chat_id in chat_ids]
        chat_object_ids = [chat_id for chat_id in chat_object_ids if chat_id is not None]
        chat_docs = await collections["chats"].find({"_id": {"$in": chat_object_ids}}).to_list(length=None) if chat_object_ids else []
        chat_title_map = {str(chat_doc["_id"]): chat_doc.get("title", "Chat") for chat_doc in chat_docs}

        results = []
        for doc in message_docs:
            content = doc.get("content", "")
            results.append(
                {
                    "chat_id": doc.get("chat_id"),
                    "chat_title": chat_title_map.get(doc.get("chat_id"), "Chat"),
                    "message_id": str(doc["_id"]),
                    "snippet": _split_for_snippet(content, limit=240),
                    "created_at": doc.get("created_at"),
                }
            )
        return results

    @staticmethod
    async def export_chat_markdown(project_id: str, chat_id: str, user_id: str) -> Optional[str]:
        chat = await ProjectWorkspaceService.get_chat(project_id, chat_id, user_id)
        if not chat:
            return None

        messages = await ProjectWorkspaceService.get_messages(project_id, chat_id, user_id, limit=500)
        if messages is None:
            return None

        lines = [
            f"# {chat['title']}",
            "",
            f"- Project ID: {project_id}",
            f"- Chat ID: {chat_id}",
            f"- Exported At (UTC): {datetime.utcnow().isoformat()}",
            "",
            "---",
            "",
        ]

        for message in messages:
            role = message.get("role", "assistant").upper()
            created_at = message.get("created_at")
            timestamp = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at)
            lines.append(f"## {role} ({timestamp})")
            lines.append("")
            lines.append(message.get("content", ""))
            lines.append("")

        return "\n".join(lines).strip() + "\n"
