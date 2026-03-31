from pydantic import BaseModel, Field


class AskRequest(BaseModel):
	"""Request schema for chat questions."""

	question: str = Field(..., min_length=3, description="Student question to answer")
