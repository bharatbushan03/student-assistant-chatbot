import logging
import jwt
from typing import Dict, Any, Callable

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config.settings import get_settings

logger = logging.getLogger(__name__)

# FastAPI security scheme to extract token from header
security = HTTPBearer()


def _resolve_role(raw_role: object) -> str:
    """Normalize unknown role values and default legacy tokens to student."""
    if isinstance(raw_role, str):
        lowered = raw_role.strip().lower()
        if lowered in {"student", "faculty", "admin"}:
            return lowered
    return "student"

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    """
    Validate the JWT token passed by the frontend.
    The Node backend signed this token using JWT_SECRET.
    """
    token = credentials.credentials
    settings = get_settings()

    try:
        # Node uses HS256 by default via jsonwebtoken
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        # The Node model puts `id` inside payload
        if "id" not in payload:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        payload["role"] = _resolve_role(payload.get("role"))
        return payload

    except jwt.ExpiredSignatureError:
        logger.warning("Expired JWT token used.")
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError as exc:
        logger.warning("Invalid JWT token: %s", exc)
        raise HTTPException(status_code=401, detail="Could not validate credentials")


def require_roles(*allowed_roles: str) -> Callable:
    """Create a reusable dependency that enforces role-based access."""
    normalized_allowed = {_resolve_role(role) for role in allowed_roles}

    def _dependency(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        role = _resolve_role(current_user.get("role"))
        if role not in normalized_allowed:
            allowed_text = ", ".join(sorted(normalized_allowed))
            raise HTTPException(
                status_code=403,
                detail=f"This endpoint requires one of the following roles: {allowed_text}.",
            )
        current_user["role"] = role
        return current_user

    return _dependency
