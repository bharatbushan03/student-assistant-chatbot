from app.utils.text_cleaning import normalize_whitespace


def clean_text(text: str) -> str:
	"""Basic text cleaning to remove extra whitespace and non-breaking spaces."""
	return normalize_whitespace(text)
