"""Tests for role-protected academic dashboard and management APIs."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import fastapi_app
from app.utils.auth import get_current_user

client = TestClient(fastapi_app)


def override_student_user():
    return {"id": "student-1", "email": "student@mietjammu.in", "role": "student"}


def override_faculty_user():
    return {"id": "faculty-1", "email": "faculty@mietjammu.in", "role": "faculty"}


def test_student_dashboard_returns_structured_response():
    users_collection = AsyncMock()
    users_collection.find_one.return_value = {
        "_id": "student-1",
        "email": "student@mietjammu.in",
        "role": "student",
        "name": "Test Student",
        "college_id": "2024A6R009",
        "section": "A",
        "semester": "4",
    }

    academics_collection = AsyncMock()
    academics_collection.find_one.return_value = {
        "student_id": "2024A6R009",
        "student_email": "student@mietjammu.in",
        "cgpa": 8.1,
        "attendance_overall": 84.0,
        "semester_results": [
            {
                "semester": "4",
                "sgpa": 8.3,
                "subjects": [
                    {
                        "name": "Operating Systems",
                        "marks": 82,
                        "grade": "A",
                        "attendance": 88,
                    }
                ],
            }
        ],
        "sgpa_trend": [
            {"semester": "3", "sgpa": 7.8},
            {"semester": "4", "sgpa": 8.3},
        ],
        "pending_tasks": [
            {
                "title": "Submit OS assignment",
                "priority": "high",
                "due_date": "2026-04-20",
            }
        ],
    }

    fastapi_app.dependency_overrides[get_current_user] = override_student_user
    try:
        with patch("app.routes.academics.get_users_collection", return_value=users_collection), patch(
            "app.routes.academics.get_student_academics_collection",
            return_value=academics_collection,
        ):
            response = client.get("/api/academics/student/dashboard")
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["profile"]["role"] == "student"
    assert data["results_summary"]["latest_sgpa"] == 8.3
    assert "analytics" in data
    assert "empty_states" in data


def test_student_dashboard_forbidden_for_faculty_user():
    fastapi_app.dependency_overrides[get_current_user] = override_faculty_user
    try:
        response = client.get("/api/academics/student/dashboard")
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 403


def test_student_records_forbidden_for_student_role():
    fastapi_app.dependency_overrides[get_current_user] = override_student_user
    try:
        response = client.get("/api/academics/students")
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 403


def test_faculty_can_upsert_student_record():
    users_collection = AsyncMock()
    users_collection.find_one.return_value = {
        "_id": "student-1",
        "email": "student@mietjammu.in",
        "name": "Test Student",
        "college_id": "2024A6R009",
        "section": "A",
        "semester": "4",
    }

    now = datetime.utcnow()
    academics_collection = AsyncMock()
    academics_collection.find_one_and_update.return_value = {
        "student_id": "2024A6R009",
        "student_email": "student@mietjammu.in",
        "student_name": "Test Student",
        "section": "A",
        "semester": "4",
        "semester_results": [
            {
                "semester": "4",
                "sgpa": 8.2,
                "subjects": [
                    {
                        "name": "Operating Systems",
                        "marks": 80,
                        "grade": "A",
                        "attendance": 85,
                    }
                ],
            }
        ],
        "sgpa_trend": [{"semester": "4", "sgpa": 8.2}],
        "cgpa": 8.0,
        "attendance_overall": 82.0,
        "pending_tasks": [{"title": "Complete project demo", "priority": "medium"}],
        "updated_by": "faculty@mietjammu.in",
        "updated_at": now,
        "created_at": now,
    }

    fastapi_app.dependency_overrides[get_current_user] = override_faculty_user
    try:
        with patch("app.routes.academics.get_users_collection", return_value=users_collection), patch(
            "app.routes.academics.get_student_academics_collection",
            return_value=academics_collection,
        ):
            response = client.put(
                "/api/academics/students/2024A6R009",
                json={
                    "semester_results": [
                        {
                            "semester": "4",
                            "sgpa": 8.2,
                            "subjects": [
                                {
                                    "name": "Operating Systems",
                                    "marks": 80,
                                    "grade": "A",
                                    "attendance": 85,
                                }
                            ],
                        }
                    ],
                    "sgpa_trend": [{"semester": "4", "sgpa": 8.2}],
                    "cgpa": 8.0,
                    "attendance_overall": 82.0,
                    "pending_tasks": [{"title": "Complete project demo", "priority": "medium"}],
                },
            )
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["student_id"] == "2024A6R009"
    assert data["updated_by"] == "faculty@mietjammu.in"


def test_bulk_upload_rejects_missing_required_columns():
    fastapi_app.dependency_overrides[get_current_user] = override_faculty_user
    try:
        response = client.post(
            "/api/academics/students/bulk-upload",
            files={"file": ("records.csv", "foo,bar\n1,2\n", "text/csv")},
        )
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "CSV must include columns" in response.json()["detail"]
