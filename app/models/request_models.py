from pydantic import BaseModel, Field, field_validator
from typing import List, Dict

class AskRequest(BaseModel):
    """Request schema for chat questions."""

    question: str = Field(..., min_length=3, description="Student question to answer")
    history: List[Dict[str, str]] = Field(default_factory=list, description="Previous conversation messages (role, content)")

    @field_validator('history')
    @classmethod
    def validate_history(cls, v: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Validate that history entries have required keys."""
        for item in v:
            if not isinstance(item, dict):
                raise ValueError("History items must be dictionaries")
            if 'role' not in item:
                raise ValueError("History items must have a 'role' key")
            if 'content' not in item:
                raise ValueError("History items must have a 'content' key")
            if item['role'] not in ['user', 'assistant', 'system']:
                raise ValueError("History role must be 'user', 'assistant', or 'system'")
        return v
