"""Academic dashboards and student performance management routes."""

from __future__ import annotations

import csv
from datetime import datetime
from io import StringIO
from typing import Dict, Iterable, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import ValidationError
from pymongo import ReturnDocument

from app.db.mongodb import get_student_academics_collection, get_users_collection
from app.schemas.academics import (
    AcademicResultsSummarySchema,
    AttendanceSummarySchema,
    BulkUploadErrorSchema,
    BulkUploadResponseSchema,
    DashboardInsightSchema,
    FacultyStudentListResponseSchema,
    FacultyStudentSummarySchema,
    PerformanceAnalyticsSchema,
    SemesterResultSchema,
    SgpaTrendPointSchema,
    StudentAcademicRecordSchema,
    StudentDashboardEmptyStatesSchema,
    StudentDashboardResponseSchema,
    StudentProfileSummarySchema,
    StudentTaskSchema,
    SubjectPerformanceSchema,
    UpsertAcademicRecordRequestSchema,
)
from app.utils.auth import require_roles

router = APIRouter()


def _normalize_role(raw_role: object) -> str:
    if isinstance(raw_role, str):
        lowered = raw_role.strip().lower()
        if lowered in {"student", "faculty", "admin"}:
            return lowered
    return "student"


def _normalize_semester_results(raw_results: object) -> List[SemesterResultSchema]:
    results: List[SemesterResultSchema] = []
    if not isinstance(raw_results, list):
        return results

    for raw in raw_results:
        try:
            results.append(SemesterResultSchema.model_validate(raw))
        except ValidationError:
            continue
    return results


def _normalize_sgpa_trend(raw_trend: object) -> List[SgpaTrendPointSchema]:
    trend: List[SgpaTrendPointSchema] = []
    if not isinstance(raw_trend, list):
        return trend

    for raw in raw_trend:
        try:
            trend.append(SgpaTrendPointSchema.model_validate(raw))
        except ValidationError:
            continue
    return trend


def _normalize_tasks(raw_tasks: object) -> List[StudentTaskSchema]:
    tasks: List[StudentTaskSchema] = []
    if not isinstance(raw_tasks, list):
        return tasks

    for raw in raw_tasks:
        try:
            tasks.append(StudentTaskSchema.model_validate(raw))
        except ValidationError:
            continue
    return tasks


def _semester_sort_key(value: str) -> tuple[int, str]:
    digits = "".join(ch for ch in value if ch.isdigit())
    if digits:
        return (int(digits), value)
    return (10_000, value)


def _build_subject_performance(
    semester_results: Iterable[SemesterResultSchema],
) -> List[SubjectPerformanceSchema]:
    marks_by_subject: Dict[str, List[float]] = {}
    for semester in semester_results:
        for subject in semester.subjects:
            marks_by_subject.setdefault(subject.name, []).append(subject.marks)

    performance: List[SubjectPerformanceSchema] = []
    for subject_name, marks in marks_by_subject.items():
        if not marks:
            continue
        average_marks = sum(marks) / len(marks)
        performance.append(
            SubjectPerformanceSchema(
                name=subject_name,
                average_marks=round(average_marks, 2),
                attempts=len(marks),
            )
        )

    performance.sort(key=lambda item: item.average_marks, reverse=True)
    return performance


def _derive_attendance(
    semester_results: Iterable[SemesterResultSchema],
    attendance_overall: Optional[float],
) -> AttendanceSummarySchema:
    if attendance_overall is not None:
        overall = max(0.0, min(100.0, float(attendance_overall)))
        return AttendanceSummarySchema(
            overall_percentage=round(overall, 2),
            below_threshold=overall < 75.0,
            threshold=75.0,
        )

    attendance_values: List[float] = []
    for semester in semester_results:
        for subject in semester.subjects:
            if subject.attendance is not None:
                attendance_values.append(subject.attendance)

    if not attendance_values:
        return AttendanceSummarySchema(overall_percentage=None, below_threshold=False, threshold=75.0)

    overall = sum(attendance_values) / len(attendance_values)
    return AttendanceSummarySchema(
        overall_percentage=round(overall, 2),
        below_threshold=overall < 75.0,
        threshold=75.0,
    )


def _build_insights(
    analytics: PerformanceAnalyticsSchema,
    pending_tasks: List[StudentTaskSchema],
) -> List[DashboardInsightSchema]:
    insights: List[DashboardInsightSchema] = []

    if analytics.attendance_summary.overall_percentage is not None and analytics.attendance_summary.below_threshold:
        insights.append(
            DashboardInsightSchema(
                type="risk",
                title="Attendance Below Threshold",
                description=(
                    f"Your attendance is {analytics.attendance_summary.overall_percentage}% and below the "
                    f"recommended {analytics.attendance_summary.threshold}% target."
                ),
                action="Attend upcoming classes and coordinate with faculty for missed sessions.",
            )
        )

    if analytics.weak_subjects:
        weak_names = ", ".join(subject.name for subject in analytics.weak_subjects[:3])
        insights.append(
            DashboardInsightSchema(
                type="improvement",
                title="Focus Areas Identified",
                description=f"Prioritize revision for: {weak_names}.",
                action="Create a weekly revision block and solve previous year papers.",
            )
        )

    if analytics.strong_subjects:
        strong_names = ", ".join(subject.name for subject in analytics.strong_subjects[:2])
        insights.append(
            DashboardInsightSchema(
                type="strength",
                title="Strong Subject Momentum",
                description=f"You are consistently performing well in {strong_names}.",
                action="Use your strengths to support weaker subjects through mixed-topic practice.",
            )
        )

    if pending_tasks:
        urgent_count = sum(1 for task in pending_tasks if task.priority == "high")
        insights.append(
            DashboardInsightSchema(
                type="upcoming",
                title="Upcoming Academic Tasks",
                description=f"You have {len(pending_tasks)} pending tasks ({urgent_count} high priority).",
                action="Finish high-priority tasks first and set reminders for due dates.",
            )
        )

    return insights


def _serialize_record(doc: dict) -> StudentAcademicRecordSchema:
    semester_results = _normalize_semester_results(doc.get("semester_results"))
    sgpa_trend = _normalize_sgpa_trend(doc.get("sgpa_trend"))
    pending_tasks = _normalize_tasks(doc.get("pending_tasks"))

    return StudentAcademicRecordSchema(
        student_id=str(doc.get("student_id", "")),
        student_email=doc.get("student_email"),
        student_name=doc.get("student_name"),
        section=doc.get("section"),
        semester=doc.get("semester"),
        semester_results=semester_results,
        sgpa_trend=sgpa_trend,
        cgpa=doc.get("cgpa"),
        attendance_overall=doc.get("attendance_overall"),
        pending_tasks=pending_tasks,
        updated_by=doc.get("updated_by"),
        updated_at=doc.get("updated_at"),
        created_at=doc.get("created_at"),
    )


def _merge_sgpa_trend(
    provided_trend: List[SgpaTrendPointSchema],
    semester_results: List[SemesterResultSchema],
) -> List[SgpaTrendPointSchema]:
    merged = {point.semester: point for point in provided_trend}

    for semester in semester_results:
        if semester.sgpa is None:
            continue
        merged.setdefault(
            semester.semester,
            SgpaTrendPointSchema(semester=semester.semester, sgpa=semester.sgpa),
        )

    trend = list(merged.values())
    trend.sort(key=lambda point: _semester_sort_key(point.semester))
    return trend


@router.get("/student/dashboard", response_model=StudentDashboardResponseSchema)
async def get_student_dashboard(
    current_user: dict = Depends(require_roles("student")),
):
    """Return a student-focused results and performance dashboard."""
    users = get_users_collection()
    academics = get_student_academics_collection()

    email = current_user.get("email")
    user = await users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    role = _normalize_role(user.get("role"))
    if user.get("role") != role:
        await users.update_one(
            {"_id": user["_id"]},
            {"$set": {"role": role, "updated_at": datetime.utcnow()}},
        )

    student_id = user.get("college_id") or str(user["_id"])
    record = await academics.find_one(
        {
            "$or": [
                {"student_id": student_id},
                {"student_email": email},
            ]
        }
    )

    semester_results = _normalize_semester_results(record.get("semester_results") if record else None)
    provided_trend = _normalize_sgpa_trend(record.get("sgpa_trend") if record else None)
    sgpa_trend = _merge_sgpa_trend(provided_trend, semester_results)
    pending_tasks = _normalize_tasks(record.get("pending_tasks") if record else None)

    latest_semester_result = None
    if semester_results:
        latest_semester_result = max(semester_results, key=lambda item: _semester_sort_key(item.semester))

    results_summary = AcademicResultsSummarySchema(
        latest_semester=latest_semester_result.semester if latest_semester_result else None,
        latest_sgpa=latest_semester_result.sgpa if latest_semester_result else None,
        cgpa=record.get("cgpa") if record else None,
        total_subjects=len(latest_semester_result.subjects) if latest_semester_result else 0,
        subjects=latest_semester_result.subjects if latest_semester_result else [],
    )

    subject_performance = _build_subject_performance(semester_results)
    analytics = PerformanceAnalyticsSchema(
        sgpa_trend=sgpa_trend,
        strong_subjects=subject_performance[:3],
        weak_subjects=list(reversed(subject_performance[-3:])) if len(subject_performance) > 3 else [],
        attendance_summary=_derive_attendance(semester_results, record.get("attendance_overall") if record else None),
    )

    insights = _build_insights(analytics, pending_tasks)

    profile = StudentProfileSummarySchema(
        id=str(user["_id"]),
        email=user["email"],
        role=role,
        name=user.get("name"),
        college_id=user.get("college_id"),
        section=user.get("section"),
        semester=user.get("semester"),
    )

    return StudentDashboardResponseSchema(
        profile=profile,
        results_summary=results_summary,
        analytics=analytics,
        insights=insights,
        pending_tasks=pending_tasks,
        empty_states=StudentDashboardEmptyStatesSchema(
            results=len(semester_results) == 0,
            analytics=len(sgpa_trend) == 0 and len(subject_performance) == 0,
            insights=len(insights) == 0,
        ),
    )


@router.get("/students", response_model=FacultyStudentListResponseSchema)
async def list_student_records(
    semester: Optional[str] = Query(default=None),
    section: Optional[str] = Query(default=None),
    student_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    _: dict = Depends(require_roles("faculty", "admin")),
):
    """List student records for faculty/admin management views."""
    academics = get_student_academics_collection()

    query: Dict[str, object] = {}
    if student_id:
        query["student_id"] = {"$regex": student_id, "$options": "i"}
    if section:
        query["section"] = {"$regex": f"^{section}$", "$options": "i"}
    if semester:
        query["$or"] = [
            {"semester": semester},
            {"semester_results.semester": semester},
            {"sgpa_trend.semester": semester},
        ]

    cursor = academics.find(query).sort("updated_at", -1).limit(limit)
    students: List[FacultyStudentSummarySchema] = []

    async for doc in cursor:
        students.append(
            FacultyStudentSummarySchema(
                student_id=str(doc.get("student_id", "")),
                student_email=doc.get("student_email"),
                student_name=doc.get("student_name"),
                section=doc.get("section"),
                semester=doc.get("semester"),
                cgpa=doc.get("cgpa"),
                attendance_overall=doc.get("attendance_overall"),
                updated_at=doc.get("updated_at"),
            )
        )

    return FacultyStudentListResponseSchema(count=len(students), students=students)


@router.get("/students/{student_id}", response_model=StudentAcademicRecordSchema)
async def get_student_record(
    student_id: str,
    _: dict = Depends(require_roles("faculty", "admin")),
):
    """Get a specific student's academic record for faculty/admin."""
    academics = get_student_academics_collection()
    users = get_users_collection()

    record = await academics.find_one({"student_id": student_id})
    if record:
        return _serialize_record(record)

    user = await users.find_one(
        {
            "$or": [
                {"college_id": student_id},
                {"email": student_id},
            ]
        }
    )
    if not user:
        raise HTTPException(status_code=404, detail="Student record not found.")

    return StudentAcademicRecordSchema(
        student_id=user.get("college_id") or str(user["_id"]),
        student_email=user.get("email"),
        student_name=user.get("name"),
        section=user.get("section"),
        semester=user.get("semester"),
        semester_results=[],
        sgpa_trend=[],
        cgpa=None,
        attendance_overall=None,
        pending_tasks=[],
        updated_by=None,
        updated_at=None,
        created_at=None,
    )


@router.put("/students/{student_id}", response_model=StudentAcademicRecordSchema)
async def upsert_student_record(
    student_id: str,
    payload: UpsertAcademicRecordRequestSchema,
    current_user: dict = Depends(require_roles("faculty", "admin")),
):
    """Create or update a student's academic record."""
    academics = get_student_academics_collection()
    users = get_users_collection()

    user = await users.find_one({"college_id": student_id})

    semester_results = payload.semester_results
    sgpa_trend = _merge_sgpa_trend(payload.sgpa_trend, semester_results)

    now = datetime.utcnow()
    update_data = {
        "student_id": student_id,
        "student_email": user.get("email") if user else None,
        "student_name": user.get("name") if user else None,
        "section": user.get("section") if user else None,
        "semester": user.get("semester") if user else None,
        "semester_results": [result.model_dump() for result in semester_results],
        "sgpa_trend": [point.model_dump() for point in sgpa_trend],
        "cgpa": payload.cgpa,
        "attendance_overall": payload.attendance_overall,
        "pending_tasks": [task.model_dump() for task in payload.pending_tasks],
        "updated_by": current_user.get("email"),
        "updated_at": now,
    }

    updated_record = await academics.find_one_and_update(
        {"student_id": student_id},
        {
            "$set": update_data,
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    return _serialize_record(updated_record)


@router.post("/students/bulk-upload", response_model=BulkUploadResponseSchema)
async def bulk_upload_student_records(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles("faculty", "admin")),
):
    """Upload CSV rows and upsert academic records with row-level validation feedback."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded.") from exc

    reader = csv.DictReader(StringIO(decoded))
    required_columns = {"student_id", "semester", "subject_name", "marks"}

    if not reader.fieldnames or not required_columns.issubset(set(reader.fieldnames)):
        raise HTTPException(
            status_code=400,
            detail=(
                "CSV must include columns: student_id, semester, subject_name, marks "
                "(optional: grade, attendance, sgpa, cgpa)."
            ),
        )

    errors: List[BulkUploadErrorSchema] = []
    grouped: Dict[str, Dict[str, object]] = {}
    processed_count = 0

    for row_index, row in enumerate(reader, start=2):
        raw_student_id = (row.get("student_id") or "").strip()
        raw_semester = (row.get("semester") or "").strip()
        raw_subject_name = (row.get("subject_name") or "").strip()
        raw_marks = (row.get("marks") or "").strip()

        if not raw_student_id or not raw_semester or not raw_subject_name or not raw_marks:
            errors.append(BulkUploadErrorSchema(row=row_index, message="Missing required field(s)."))
            continue

        try:
            marks = float(raw_marks)
        except ValueError:
            errors.append(BulkUploadErrorSchema(row=row_index, message="marks must be a numeric value."))
            continue

        if marks < 0 or marks > 100:
            errors.append(BulkUploadErrorSchema(row=row_index, message="marks must be between 0 and 100."))
            continue

        attendance = None
        raw_attendance = (row.get("attendance") or "").strip()
        if raw_attendance:
            try:
                attendance = float(raw_attendance)
            except ValueError:
                errors.append(BulkUploadErrorSchema(row=row_index, message="attendance must be numeric."))
                continue
            if attendance < 0 or attendance > 100:
                errors.append(BulkUploadErrorSchema(row=row_index, message="attendance must be between 0 and 100."))
                continue

        sgpa = None
        raw_sgpa = (row.get("sgpa") or "").strip()
        if raw_sgpa:
            try:
                sgpa = float(raw_sgpa)
            except ValueError:
                errors.append(BulkUploadErrorSchema(row=row_index, message="sgpa must be numeric."))
                continue
            if sgpa < 0 or sgpa > 10:
                errors.append(BulkUploadErrorSchema(row=row_index, message="sgpa must be between 0 and 10."))
                continue

        cgpa = None
        raw_cgpa = (row.get("cgpa") or "").strip()
        if raw_cgpa:
            try:
                cgpa = float(raw_cgpa)
            except ValueError:
                errors.append(BulkUploadErrorSchema(row=row_index, message="cgpa must be numeric."))
                continue
            if cgpa < 0 or cgpa > 10:
                errors.append(BulkUploadErrorSchema(row=row_index, message="cgpa must be between 0 and 10."))
                continue

        bucket = grouped.setdefault(
            raw_student_id,
            {
                "student_id": raw_student_id,
                "semester_results": {},
                "cgpa": None,
            },
        )

        semester_bucket = bucket["semester_results"].setdefault(
            raw_semester,
            {
                "semester": raw_semester,
                "sgpa": None,
                "subjects": [],
            },
        )

        semester_bucket["subjects"].append(
            {
                "name": raw_subject_name,
                "code": (row.get("subject_code") or "").strip() or None,
                "marks": marks,
                "grade": (row.get("grade") or "").strip() or None,
                "attendance": attendance,
            }
        )

        if sgpa is not None:
            semester_bucket["sgpa"] = sgpa
        if cgpa is not None:
            bucket["cgpa"] = cgpa

        processed_count += 1

    academics = get_student_academics_collection()
    users = get_users_collection()
    updated_records = 0
    now = datetime.utcnow()

    for student_key, aggregate in grouped.items():
        semester_results = list(aggregate["semester_results"].values())
        validated_results = _normalize_semester_results(semester_results)
        trend = _merge_sgpa_trend([], validated_results)
        user = await users.find_one({"college_id": student_key})

        update_data = {
            "student_id": student_key,
            "student_email": user.get("email") if user else None,
            "student_name": user.get("name") if user else None,
            "section": user.get("section") if user else None,
            "semester": user.get("semester") if user else None,
            "semester_results": [result.model_dump() for result in validated_results],
            "sgpa_trend": [point.model_dump() for point in trend],
            "cgpa": aggregate.get("cgpa"),
            "updated_by": current_user.get("email"),
            "updated_at": now,
        }

        await academics.update_one(
            {"student_id": student_key},
            {
                "$set": update_data,
                "$setOnInsert": {"created_at": now, "pending_tasks": []},
            },
            upsert=True,
        )
        updated_records += 1

    return BulkUploadResponseSchema(
        processed_count=processed_count,
        updated_records=updated_records,
        errors=errors,
    )
