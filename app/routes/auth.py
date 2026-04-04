"""Authentication routes for user login, signup, and profile management."""

import logging
import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import os

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field

from app.config.settings import get_settings
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory user storage (replace with database in production)
USERS_DB: Dict[str, dict] = {}


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
        # Handle case where existing hash might be from old SHA256 method
        import hashlib
        sha256_hash = hashlib.sha256(password.encode()).hexdigest()
        if sha256_hash == hashed_password:
            logger.warning("User authenticated with deprecated SHA256 hash")
            return True
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

    # Check if user already exists
    if email in USERS_DB:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists."
        )

    # Create new user
    user_id = str(hash(email) % 1000000)
    USERS_DB[email] = {
        "id": user_id,
        "email": email,
        "password": hash_password(request.password),
        "created_at": datetime.utcnow().isoformat(),
        "name": None,
        "college_id": None,
        "section": None,
        "semester": None,
        "profile_picture": None
    }

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

    if email not in USERS_DB:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials."
        )

    user = USERS_DB[email]

    if not verify_password(request.password, user["password"]):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials."
        )

    token = create_token(user["id"], email)

    return {
        "success": True,
        "user": {
            "id": user["id"],
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

    if email not in USERS_DB:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    user = USERS_DB[email]

    return {
        "success": True,
        "user": {
            "id": user["id"],
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

    if email not in USERS_DB:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    user = USERS_DB[email]

    # Update fields
    if profile_data.name is not None:
        user["name"] = profile_data.name
    if profile_data.college_id is not None:
        user["college_id"] = profile_data.college_id
    if profile_data.section is not None:
        user["section"] = profile_data.section
    if profile_data.semester is not None:
        user["semester"] = profile_data.semester
    if profile_data.profile_picture is not None:
        user["profile_picture"] = profile_data.profile_picture

    return {
        "success": True,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name"),
            "college_id": user.get("college_id"),
            "section": user.get("section"),
            "semester": user.get("semester"),
            "profile_picture": user.get("profile_picture")
        }
    }
