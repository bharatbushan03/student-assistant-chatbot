# routes package
from app.routes.chat import router as chat_router
from app.routes.auth import router as auth_router
from app.routes.groups import router as groups_router
from app.routes.messages import router as messages_router

__all__ = ["chat_router", "auth_router", "groups_router", "messages_router"]
