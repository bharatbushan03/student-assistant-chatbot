"""Join registered students with academic records for the admin dashboard."""

from __future__ import annotations

from typing import Iterable, Optional

ATTENDANCE_RISK_THRESHOLD = 75.0
SCORE_RISK_THRESHOLD = 6.0


def _semester_sort_value(semester: str) -> int:
    digits = "".join(ch for ch in semester if ch.isdigit())
    if digits:
        return int(digits)
    return 0


def latest_sgpa(record: Optional[dict]) -> Optional[float]:
    """Return the SGPA from the highest numbered semester on a record."""
    if not record:
        return None

    points: list[tuple[str, float]] = []
    for source in (record.get("sgpa_trend") or [], record.get("semester_results") or []):
        if not isinstance(source, list):
            continue
        for item in source:
            if not isinstance(item, dict) or item.get("sgpa") is None:
                continue
            try:
                points.append((str(item.get("semester") or ""), float(item["sgpa"])))
            except (TypeError, ValueError):
                continue

    if not points:
        return None

    return max(points, key=lambda point: _semester_sort_value(point[0]))[1]


def classify_academic_status(
    *,
    has_record: bool,
    cgpa: Optional[float],
    attendance: Optional[float],
    latest_sgpa_value: Optional[float],
) -> str:
    """Label a student as missing a record, at risk, or on track."""
    if not has_record:
        return "missing_record"

    score = cgpa if cgpa is not None else latest_sgpa_value
    attendance_risk = attendance is not None and attendance < ATTENDANCE_RISK_THRESHOLD
    score_risk = score is not None and score < SCORE_RISK_THRESHOLD
    if attendance_risk or score_risk:
        return "at_risk"
    return "on_track"


def _optional_float(value) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _row_from(user: Optional[dict], record: Optional[dict], student_id: str) -> dict:
    college_id = ""
    email = ""
    name = None
    section = None
    semester = None

    if user:
        college_id = str(user.get("college_id") or "").strip()
        email = str(user.get("email") or "").strip()
        name = user.get("name")
        section = user.get("section")
        semester = user.get("semester")

    if record:
        email = email or str(record.get("student_email") or "").strip()
        name = name or record.get("student_name")
        section = section or record.get("section")
        semester = semester or record.get("semester")

    cgpa = _optional_float(record.get("cgpa")) if record else None
    attendance = _optional_float(record.get("attendance_overall")) if record else None
    sgpa = latest_sgpa(record)
    pending_tasks = record.get("pending_tasks") if record else None
    pending_count = len(pending_tasks) if isinstance(pending_tasks, list) else 0

    return {
        "student_id": student_id,
        "email": email or None,
        "name": name,
        "section": section,
        "semester": semester,
        "cgpa": cgpa,
        "latest_sgpa": sgpa,
        "attendance_overall": attendance,
        "pending_task_count": pending_count,
        "status": classify_academic_status(
            has_record=record is not None,
            cgpa=cgpa,
            attendance=attendance,
            latest_sgpa_value=sgpa,
        ),
    }


def build_student_directory(users: Iterable[dict], records: Iterable[dict]) -> list[dict]:
    """Match student accounts to academic records, including unmatched records."""
    user_list = list(users)
    record_list = list(records)

    records_by_id: dict[str, dict] = {}
    records_by_email: dict[str, dict] = {}
    for record in record_list:
        student_id = str(record.get("student_id") or "").strip()
        if student_id:
            records_by_id[student_id.lower()] = record
        email = str(record.get("student_email") or "").strip().lower()
        if email:
            records_by_email[email] = record

    rows: list[dict] = []
    used_record_ids: set[int] = set()

    for user in user_list:
        role = str(user.get("role") or "student").strip().lower()
        if role != "student":
            continue

        college_id = str(user.get("college_id") or "").strip()
        email = str(user.get("email") or "").strip().lower()
        record = None
        if college_id and college_id.lower() in records_by_id:
            record = records_by_id[college_id.lower()]
        elif email and email in records_by_email:
            record = records_by_email[email]

        if record is not None:
            used_record_ids.add(id(record))

        student_id = college_id or email or str(user.get("_id") or "")
        if not student_id:
            continue
        rows.append(_row_from(user, record, student_id))

    for record in record_list:
        if id(record) in used_record_ids:
            continue
        student_id = str(record.get("student_id") or "").strip()
        if not student_id:
            continue
        rows.append(_row_from(None, record, student_id))

    status_rank = {"at_risk": 0, "missing_record": 1, "on_track": 2}
    rows.sort(
        key=lambda row: (
            status_rank.get(row["status"], 3),
            (row.get("name") or row["student_id"]).lower(),
        )
    )
    return rows


def summarize_directory(rows: Iterable[dict]) -> dict:
    """Aggregate cohort counts and averages for the admin overview."""
    row_list = list(rows)
    cgpas = [row["cgpa"] for row in row_list if row.get("cgpa") is not None]
    attendance_values = [
        row["attendance_overall"] for row in row_list if row.get("attendance_overall") is not None
    ]

    return {
        "total_students": len(row_list),
        "records_on_file": sum(1 for row in row_list if row.get("status") != "missing_record"),
        "missing_records": sum(1 for row in row_list if row.get("status") == "missing_record"),
        "at_risk_count": sum(1 for row in row_list if row.get("status") == "at_risk"),
        "on_track_count": sum(1 for row in row_list if row.get("status") == "on_track"),
        "average_cgpa": round(sum(cgpas) / len(cgpas), 2) if cgpas else None,
        "average_attendance": round(sum(attendance_values) / len(attendance_values), 2) if attendance_values else None,
    }


def filter_directory(
    rows: Iterable[dict],
    *,
    query: str = "",
    semester: str = "",
    section: str = "",
    status: str = "",
) -> list[dict]:
    """Apply the admin directory filters."""
    needle = query.strip().lower()
    semester_filter = semester.strip().lower()
    section_filter = section.strip().lower()
    status_filter = status.strip().lower()

    filtered = []
    for row in rows:
        if status_filter and status_filter != "all" and row.get("status") != status_filter:
            continue
        if semester_filter and str(row.get("semester") or "").strip().lower() != semester_filter:
            continue
        if section_filter and str(row.get("section") or "").strip().lower() != section_filter:
            continue
        if needle:
            haystack = " ".join(
                str(row.get(field) or "")
                for field in ("student_id", "email", "name", "section", "semester")
            ).lower()
            if needle not in haystack:
                continue
        filtered.append(row)
    return filtered
