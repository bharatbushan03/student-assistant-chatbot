"""Shared file attachment ingestion helpers for chat and group uploads."""

from __future__ import annotations

import asyncio
import csv
import importlib
import io
import json
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

ALLOWED_ATTACHMENT_EXTENSIONS = {
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


def _safe_filename(name: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return sanitized.strip("._") or "file"


def _extract_text_from_payload(filename: str, content_type: str, payload: bytes) -> str:
    extension = Path(filename).suffix.lower()

    if extension == ".pdf":
        try:
            pdf_module = importlib.import_module("pypdf")
            pdf_reader_cls = getattr(pdf_module, "PdfReader")
        except Exception as exc:
            raise ValueError("PDF support is unavailable on the server.") from exc

        reader = pdf_reader_cls(io.BytesIO(payload))
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
        return f"Image uploaded: {filename}."

    return payload.decode("utf-8", errors="ignore")[:12000]


def _preview_text(text: str, limit: int = 280) -> str:
    cleaned = " ".join((text or "").split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[:limit].rstrip()}..."


async def ingest_upload_file(
    upload: Any,
    *,
    max_bytes: int,
    save_dir: Path | None = None,
) -> dict[str, Any]:
    """Validate, parse, and optionally persist an uploaded attachment."""
    filename = upload.filename or "file"
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise ValueError("Unsupported file type. Allowed: PDF, TXT, JSON, CSV, and common images.")

    payload = await upload.read()
    if not payload:
        raise ValueError("Uploaded file is empty.")

    if len(payload) > max_bytes:
        raise ValueError(f"File too large. Maximum size is {max_bytes // (1024 * 1024)}MB.")

    extracted_text = _extract_text_from_payload(filename, upload.content_type or "", payload)
    preview = _preview_text(extracted_text)

    stored_name = None
    storage_path = None
    if save_dir is not None:
        save_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid4().hex}_{_safe_filename(filename)}"
        path = save_dir / stored_name
        await asyncio.to_thread(path.write_bytes, payload)
        storage_path = str(path)

    return {
        "filename": filename,
        "content_type": upload.content_type or "application/octet-stream",
        "size_bytes": len(payload),
        "preview_text": preview,
        "extracted_text": extracted_text[:50000],
        "stored_name": stored_name,
        "storage_path": storage_path,
    }
