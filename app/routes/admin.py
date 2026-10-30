"""Admin and faculty oversight of student dashboards, notices, and staff accounts."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.config.settings import get_settings
from app.db.mongodb import get_notices_collection, get_student_academics_collection, get_users_collection
from app.routes.academics import compose_student_dashboard, load_student_notices
from app.routes.auth import hash_password
from app.schemas.academics import NoticeSchema
from app.schemas.admin import (
    AdminOverviewSchema,
    AdminPlatformSchema,
    AdminStudentDashboardSchema,
    AdminStudentListSchema,
    AdminStudentRowSchema,
    CreateNoticeRequestSchema,
    NoticeListSchema,
    ProvisionAccountRequestSchema,
    ProvisionAccountResponseSchema,
)
from app.services.student_oversight import build_student_directory, filter_directory, summarize_directory
from app.utils.auth import require_roles

router = APIRouter()

FACULTY_ADMIN_EMAIL_PATTERN = r"^[a-z]+(?:\.[a-z]+)+@mietjammu\.in$"


async def _directory_rows() -> list[dict]:
    users = get_users_collection()
    academics = get_student_academics_collection()
    user_docs = await users.find({"role": "student"}).to_list(length=5000)
    record_docs = await academics.find({}).to_list(length=5000)
    return build_student_directory(user_docs, record_docs)


def _platform_status() -> AdminPlatformSchema:
    settings = get_settings()
    return AdminPlatformSchema(
        llm_provider="nvidia_nemotron",
        llm_model=settings.nvidia_model,
        vector_db="pinecone",
        pinecone_index=settings.pinecone_index_name,
    )


@router.get("/overview", response_model=AdminOverviewSchema)
async def admin_overview(_: dict = Depends(require_roles("faculty", "admin"))):
    """Cohort summary for the admin student dashboard."""
    rows = await _directory_rows()
    summary = summarize_directory(rows)
    at_risk = [AdminStudentRowSchema.model_validate(row) for row in rows if row["status"] == "at_risk"][:12]
    return AdminOverviewSchema(
        **summary,
        at_risk_students=at_risk,
        platform=_platform_status(),
    )


@router.get("/students", response_model=AdminStudentListSchema)
async def admin_student_directory(
    q: str = Query(default=""),
    semester: str = Query(default=""),
    section: str = Query(default=""),
    status: str = Query(default="all"),
    _: dict = Depends(require_roles("faculty", "admin")),
):
    """Search every student account together with academic status."""
    allowed_status = {"", "all", "on_track", "at_risk", "missing_record"}
    if status not in allowed_status:
        raise HTTPException(status_code=400, detail="Status filter must be all, on_track, at_risk, or missing_record.")

    rows = filter_directory(
        await _directory_rows(),
        query=q,
        semester=semester,
        section=section,
        status=status,
    )
    students = [AdminStudentRowSchema.model_validate(row) for row in rows]
    return AdminStudentListSchema(count=len(students), students=students)


@router.get("/students/{student_id}/dashboard", response_model=AdminStudentDashboardSchema)
async def admin_student_dashboard(
    student_id: str,
    _: dict = Depends(require_roles("faculty", "admin")),
):
    """Return the same dashboard a student sees, for faculty and admin review."""
    users = get_users_collection()
    academics = get_student_academics_collection()
    lookup = student_id.strip()

    user_query: dict = {
        "$or": [
            {"college_id": lookup},
            {"email": lookup.lower()},
        ]
    }
    if ObjectId.is_valid(lookup):
        user_query["$or"].append({"_id": ObjectId(lookup)})

    user = await users.find_one(user_query)
    record = None
    if user:
        keys = [str(user.get("college_id") or "").strip(), str(user["_id"])]
        email = user.get("email")
        record_query = [{"student_id": key} for key in keys if key]
        if email:
            record_query.append({"student_email": email})
        record = await academics.find_one({"$or": record_query}) if record_query else None
    else:
        record = await academics.find_one(
            {
                "$or": [
                    {"student_id": lookup},
                    {"student_email": lookup.lower()},
                ]
            }
        )
        if record:
            user = {
                "_id": record.get("student_id") or lookup,
                "email": record.get("student_email") or f"{lookup}@unlinked.local",
                "role": "student",
                "name": record.get("student_name"),
                "college_id": record.get("student_id"),
                "section": record.get("section"),
                "semester": record.get("semester"),
            }

    if not user and not record:
        raise HTTPException(status_code=404, detail="Student not found.")

    notices = await load_student_notices()
    return compose_student_dashboard(user, record, notices)


@router.get("/notices", response_model=NoticeListSchema)
async def list_notices(_: dict = Depends(require_roles("faculty", "admin"))):
    """List campus notices for the oversight dashboard."""
    notices = get_notices_collection()
    cursor = notices.find({}).sort("created_at", -1).limit(50)
    items: list[NoticeSchema] = []
    async for doc in cursor:
        audience = doc.get("audience") if doc.get("audience") in {"all", "students"} else "all"
        items.append(
            NoticeSchema(
                id=str(doc["_id"]),
                title=str(doc.get("title") or "Notice"),
                body=str(doc.get("body") or ""),
                audience=audience,
                created_by=doc.get("created_by"),
                created_at=doc.get("created_at"),
            )
        )
    return NoticeListSchema(count=len(items), notices=items)


@router.post("/notices", response_model=NoticeSchema)
async def create_notice(
    payload: CreateNoticeRequestSchema,
    current_user: dict = Depends(require_roles("faculty", "admin")),
):
    """Publish a notice that appears on student dashboards."""
    now = datetime.utcnow()
    doc = {
        "title": payload.title.strip(),
        "body": payload.body.strip(),
        "audience": payload.audience,
        "created_by": current_user.get("email"),
        "created_at": now,
    }
    result = await get_notices_collection().insert_one(doc)
    return NoticeSchema(
        id=str(result.inserted_id),
        title=doc["title"],
        body=doc["body"],
        audience=doc["audience"],
        created_by=doc["created_by"],
        created_at=now,
    )


@router.delete("/notices/{notice_id}")
async def delete_notice(
    notice_id: str,
    _: dict = Depends(require_roles("admin")),
):
    """Remove a campus notice. Admin only."""
    try:
        object_id = ObjectId(notice_id)
    except (InvalidId, TypeError) as exc:
        raise HTTPException(status_code=404, detail="Notice not found.") from exc

    result = await get_notices_collection().delete_one({"_id": object_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notice not found.")
    return {"success": True}


@router.post("/accounts", response_model=ProvisionAccountResponseSchema)
async def provision_staff_account(
    payload: ProvisionAccountRequestSchema,
    _: dict = Depends(require_roles("admin")),
):
    """Create a faculty or admin account. Students continue to self-register."""
    email = payload.email.strip().lower()
    if not re.match(FACULTY_ADMIN_EMAIL_PATTERN, email):
        raise HTTPException(
            status_code=400,
            detail="Faculty/Admin email must follow format yourname.dept@mietjammu.in.",
        )

    users = get_users_collection()
    existing = await users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    now = datetime.utcnow()
    name = payload.name.strip() if payload.name else None
    result = await users.insert_one(
        {
            "email": email,
            "password": hash_password(payload.password),
            "role": payload.role,
            "name": name,
            "college_id": None,
            "section": None,
            "semester": None,
            "project": None,
            "profile_picture": None,
            "created_at": now,
            "updated_at": now,
        }
    )
    return ProvisionAccountResponseSchema(
        id=str(result.inserted_id),
        email=email,
        role=payload.role,
        name=name,
        created_at=now,
    )
