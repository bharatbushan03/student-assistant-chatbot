"""Authentication routes for user login, signup, and profile management."""

import logging
import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Any
from bson import ObjectId

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field

from app.config.settings import get_settings
from app.utils.auth import get_current_user
from app.db.mongodb import get_users_collection

logger = logging.getLogger(__name__)

router = APIRouter()


def hash_password(password: str) -> str:
    """Hash password using bcrypt with automatic salt generation."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode(), salt)
    return hashed.decode()


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode(), hashed_password.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    """Create JWT token for authenticated user."""
    settings = get_settings()
    payload = {
        "id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


class SignupRequest(BaseModel):
    email: str = EmailStr()
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: str = EmailStr()
    password: str


class UserProfile(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    college_id: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[str] = None
    profile_picture: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    college_id: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[str] = None
    profile_picture: Optional[str] = None


@router.post("/signup")
async def signup(request: SignupRequest):
    """Register a new user with MIET email."""
    email = request.email.lower()

    # Validate MIET email domain
    if not email.endswith('@mietjammu.in'):
        raise HTTPException(
            status_code=400,
            detail="Registration is strictly restricted to @mietjammu.in domains."
        )

    users = get_users_collection()

    # Check if user already exists
    existing_user = await users.find_one({"email": email})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists."
        )

    # Create new user
    user_data = {
        "email": email,
        "password": hash_password(request.password),
        "created_at": datetime.utcnow(),
        "name": None,
        "college_id": None,
        "section": None,
        "semester": None,
        "profile_picture": None
    }

    result = await users.insert_one(user_data)
    user_id = str(result.inserted_id)

    token = create_token(user_id, email)

    return {
        "success": True,
        "user": {
            "id": user_id,
            "email": email,
            "name": None,
            "college_id": None,
            "section": None,
            "semester": None,
            "profile_picture": None
        },
        "token": token
    }


@router.post("/login")
async def login(request: LoginRequest):
    """Authenticate user and return JWT token."""
    email = request.email.lower()

    users = get_users_collection()
    user = await users.find_one({"email": email})

    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials."
        )

    token = create_token(str(user["_id"]), email)

    return {
        "success": True,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name"),
            "college_id": user.get("college_id"),
            "section": user.get("section"),
            "semester": user.get("semester"),
            "profile_picture": user.get("profile_picture")
        },
        "token": token
    }


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile."""
    email = current_user.get("email")

    users = get_users_collection()
    user = await users.find_one({"email": email})

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    return {
        "success": True,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name"),
            "college_id": user.get("college_id"),
            "section": user.get("section"),
            "semester": user.get("semester"),
            "profile_picture": user.get("profile_picture")
        }
    }


@router.put("/profile")
async def update_profile(
    profile_data: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update current user profile."""
    email = current_user.get("email")

    users = get_users_collection()
    user = await users.find_one({"email": email})

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    # Build update dict with only provided fields
    update_data = {}
    if profile_data.name is not None:
        update_data["name"] = profile_data.name
    if profile_data.college_id is not None:
        update_data["college_id"] = profile_data.college_id
    if profile_data.section is not None:
        update_data["section"] = profile_data.section
    if profile_data.semester is not None:
        update_data["semester"] = profile_data.semester
    if profile_data.profile_picture is not None:
        update_data["profile_picture"] = profile_data.profile_picture

    if update_data:
        await users.update_one({"email": email}, {"$set": update_data})

    # Fetch updated user
    updated_user = await users.find_one({"email": email})

    return {
        "success": True,
        "user": {
            "id": str(updated_user["_id"]),
            "email": updated_user["email"],
            "name": updated_user.get("name"),
            "college_id": updated_user.get("college_id"),
            "section": updated_user.get("section"),
            "semester": updated_user.get("semester"),
            "profile_picture": updated_user.get("profile_picture")
        }
    }


@router.get("/users")
async def list_all_users():
    """List all registered users (admin endpoint for debugging).

    WARNING: In production, this should be protected by admin-only authentication.
    For now, returns only email addresses and creation dates.
    """
    users = get_users_collection()

    # Fetch all users, excluding password hashes
    cursor = users.find({}, {"password": 0}).sort("created_at", 1)

    user_list = []
    async for user in cursor:
        user_list.append({
            "id": str(user["_id"]),
            "email": user["email"],
            "created_at": user.get("created_at", "").isoformat() if isinstance(user.get("created_at"), datetime) else str(user.get("created_at", "")),
            "name": user.get("name"),
            "college_id": user.get("college_id"),
        })

    return {
        "success": True,
        "count": len(user_list),
        "users": user_list
    }
