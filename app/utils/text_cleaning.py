import re


def normalize_whitespace(text: str) -> str:
	"""Collapse whitespace and trim edges for storage and embedding."""
	cleaned = text.replace("\u00a0", " ")
	return re.sub(r"\s+", " ", cleaned).strip()
