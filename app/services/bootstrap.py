"""Create the first administrator account from environment variables."""

import logging
import re
from datetime import datetime

from app.config.settings import get_settings
from app.db.mongodb import get_users_collection
from app.routes.auth import hash_password

logger = logging.getLogger(__name__)

FACULTY_ADMIN_EMAIL_PATTERN = r"^[a-z]+(?:\.[a-z]+)+@mietjammu\.in$"


async def ensure_bootstrap_admin() -> None:
    """Insert one admin when none exists and bootstrap credentials are configured."""
    settings = get_settings()
    email = (settings.bootstrap_admin_email or "").strip().lower()
    password = settings.bootstrap_admin_password or ""
    if not email or not password:
        return

    if not re.match(FACULTY_ADMIN_EMAIL_PATTERN, email):
        logger.warning(
            "BOOTSTRAP_ADMIN_EMAIL must look like yourname.dept@mietjammu.in. Skipping bootstrap admin."
        )
        return

    if len(password) < 8:
        logger.warning("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters. Skipping bootstrap admin.")
        return

    users = get_users_collection()
    existing_admin = await users.find_one({"role": "admin"})
    if existing_admin:
        return

    existing_email = await users.find_one({"email": email})
    if existing_email:
        logger.warning("Bootstrap admin email already belongs to another account. Skipping.")
        return

    now = datetime.utcnow()
    await users.insert_one(
        {
            "email": email,
            "password": hash_password(password),
            "role": "admin",
            "name": settings.bootstrap_admin_name,
            "college_id": None,
            "section": None,
            "semester": None,
            "project": None,
            "profile_picture": None,
            "created_at": now,
            "updated_at": now,
        }
    )
    logger.info("Bootstrap admin account created for %s", email)
