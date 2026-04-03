from pydantic import BaseModel, Field
from typing import List, Dict

class AskRequest(BaseModel):
	"""Request schema for chat questions."""

	question: str = Field(..., min_length=3, description="Student question to answer")
	history: List[Dict[str, str]] = Field(default_factory=list, description="Previous conversation messages (role, content)")
