import logging
import jwt
from typing import Dict, Any

from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config.settings import get_settings

logger = logging.getLogger(__name__)

# FastAPI security scheme to extract token from header
security = HTTPBearer()

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
        return payload

    except jwt.ExpiredSignatureError:
        logger.warning("Expired JWT token used.")
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError as exc:
        logger.warning("Invalid JWT token: %s", exc)
        raise HTTPException(status_code=401, detail="Could not validate credentials")
