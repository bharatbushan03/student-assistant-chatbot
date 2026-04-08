"""Tests for authentication endpoint behavior and resilience."""

import jwt
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from pymongo.errors import ServerSelectionTimeoutError

from app.main import fastapi_app
from app.routes.auth import hash_password, verify_password
from app.config.settings import get_settings
from app.utils.auth import get_current_user

client = TestClient(fastapi_app)


def override_get_current_user():
    """Override auth dependency for protected endpoint tests."""
    return {"id": "test-user", "email": "test@mietjammu.in", "role": "student"}


def test_login_returns_503_when_mongodb_unavailable():
    """Login should fail gracefully with 503 when MongoDB is unreachable."""
    users_collection = AsyncMock()
    users_collection.find_one.side_effect = ServerSelectionTimeoutError("MongoDB unavailable")

    with patch("app.routes.auth.get_users_collection", return_value=users_collection):
        response = client.post(
            "/auth/login",
            json={"email": "student@mietjammu.in", "password": "password123"},
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "Database service is temporarily unavailable. Please try again shortly."


def test_change_password_returns_503_when_mongodb_unavailable():
    """Change password should fail gracefully with 503 when MongoDB is unreachable."""
    users_collection = AsyncMock()
    users_collection.find_one.side_effect = ServerSelectionTimeoutError("MongoDB unavailable")

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        with patch("app.routes.auth.get_users_collection", return_value=users_collection):
            response = client.post(
                "/auth/change-password",
                json={
                    "current_password": "OldPassword123",
                    "new_password": "NewPassword123",
                    "confirm_password": "NewPassword123",
                },
            )
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json()["detail"] == "Database service is temporarily unavailable. Please try again shortly."


def test_change_password_rejects_incorrect_current_password():
    """Endpoint should reject requests with an incorrect current password."""
    users_collection = AsyncMock()
    users_collection.find_one.return_value = {
        "email": "test@mietjammu.in",
        "password": hash_password("OldPassword123"),
    }

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        with patch("app.routes.auth.get_users_collection", return_value=users_collection):
            response = client.post(
                "/auth/change-password",
                json={
                    "current_password": "WrongPassword123",
                    "new_password": "NewPassword123",
                    "confirm_password": "NewPassword123",
                },
            )
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect."
    users_collection.update_one.assert_not_called()


def test_change_password_rejects_confirmation_mismatch():
    """Endpoint should reject mismatched new password confirmation."""
    users_collection = AsyncMock()
    users_collection.find_one.return_value = {
        "email": "test@mietjammu.in",
        "password": hash_password("OldPassword123"),
    }

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        with patch("app.routes.auth.get_users_collection", return_value=users_collection):
            response = client.post(
                "/auth/change-password",
                json={
                    "current_password": "OldPassword123",
                    "new_password": "NewPassword123",
                    "confirm_password": "DifferentPassword123",
                },
            )
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json()["detail"] == "New password and confirmation do not match."
    users_collection.update_one.assert_not_called()


def test_change_password_updates_password_hash():
    """Endpoint should hash and persist the new password when request is valid."""
    users_collection = AsyncMock()
    users_collection.find_one.return_value = {
        "email": "test@mietjammu.in",
        "password": hash_password("OldPassword123"),
    }

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        with patch("app.routes.auth.get_users_collection", return_value=users_collection):
            response = client.post(
                "/auth/change-password",
                json={
                    "current_password": "OldPassword123",
                    "new_password": "NewPassword123",
                    "confirm_password": "NewPassword123",
                },
            )
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["message"] == "Password changed successfully."

    users_collection.update_one.assert_called_once()
    update_document = users_collection.update_one.call_args.args[1]
    updated_hash = update_document["$set"]["password"]

    assert updated_hash != "NewPassword123"
    assert verify_password("NewPassword123", updated_hash) is True


def test_signup_rejects_faculty_admin_mode():
    """Public signup must block faculty/admin provisioning attempts."""
    response = client.post(
        "/auth/signup",
        json={
            "email": "faculty@mietjammu.in",
            "password": "SecurePass123",
            "mode": "faculty_admin",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Faculty/Admin accounts are provisioned by system administrators."


def test_signup_rejects_student_email_that_is_not_rollno_format():
    """Student signup requires rollno-style email without dot-separated segments."""
    response = client.post(
        "/auth/signup",
        json={
            "email": "john.cse@mietjammu.in",
            "password": "SecurePass123",
            "mode": "student",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Student email must follow format yourrollno@mietjammu.in."


def test_login_rejects_invalid_faculty_admin_email_format():
    """Faculty/Admin login mode requires name.dept-style emails."""
    response = client.post(
        "/auth/login",
        json={
            "email": "faculty@mietjammu.in",
            "password": "StrongPass123",
            "mode": "faculty_admin",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Faculty/Admin email must follow format yourname.dept@mietjammu.in."


def test_login_rejects_student_mode_for_faculty_accounts():
    """Faculty users should not be able to authenticate via Student mode."""
    users_collection = AsyncMock()
    users_collection.find_one.return_value = {
        "_id": "faculty-1",
        "email": "faculty@mietjammu.in",
        "password": hash_password("StrongPass123"),
        "role": "faculty",
    }

    with patch("app.routes.auth.get_users_collection", return_value=users_collection):
        response = client.post(
            "/auth/login",
            json={
                "email": "faculty@mietjammu.in",
                "password": "StrongPass123",
                "mode": "student",
            },
        )

    assert response.status_code == 403
    assert response.json()["detail"] == "This account is not allowed in Student mode."


def test_login_includes_role_claim_and_backfills_legacy_user():
    """Legacy users missing role should default to student and receive role claim in JWT."""
    users_collection = AsyncMock()
    users_collection.find_one.return_value = {
        "_id": "student-1",
        "email": "student@mietjammu.in",
        "password": hash_password("StrongPass123"),
    }

    with patch("app.routes.auth.get_users_collection", return_value=users_collection):
        response = client.post(
            "/auth/login",
            json={
                "email": "student@mietjammu.in",
                "password": "StrongPass123",
                "mode": "student",
            },
        )

    assert response.status_code == 200
    payload = jwt.decode(response.json()["token"], get_settings().jwt_secret, algorithms=["HS256"])
    assert payload["role"] == "student"
    assert response.json()["user"]["role"] == "student"
    users_collection.update_one.assert_called_once()


def test_update_profile_accepts_project_field():
    """Profile update should persist optional project field."""
    users_collection = AsyncMock()
    users_collection.find_one.side_effect = [
        {
            "_id": "user-1",
            "email": "test@mietjammu.in",
            "name": "Test User",
            "role": "student",
            "college_id": "2024A6R009",
            "section": "A",
            "semester": "4",
            "project": None,
            "profile_picture": None,
        },
        {
            "_id": "user-1",
            "email": "test@mietjammu.in",
            "name": "Test User",
            "role": "student",
            "college_id": "2024A6R009",
            "section": "A",
            "semester": "4",
            "project": "Campus Event Planner",
            "profile_picture": None,
        },
    ]

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        with patch("app.routes.auth.get_users_collection", return_value=users_collection):
            response = client.put(
                "/auth/profile",
                json={"project": "Campus Event Planner"},
            )
    finally:
        fastapi_app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["user"]["project"] == "Campus Event Planner"

    users_collection.update_one.assert_called_once_with(
        {"email": "test@mietjammu.in"},
        {"$set": {"project": "Campus Event Planner"}},
    )
