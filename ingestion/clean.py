import re

from app.utils.text_cleaning import normalize_whitespace


_NAV_TOKENS = {
	"facebook",
	"twitter",
	"linkedin",
	"youtube",
	"instagram",
	"privacy policy",
	"terms & conditions",
	"all rights reserved",
}


def _replacement_char_ratio(text: str) -> float:
	if not text:
		return 0.0
	return text.count("�") / len(text)


def _is_noise_line(line: str) -> bool:
	"""Detect common low-value boilerplate and corrupted lines."""
	lower = line.lower()

	# Drop strongly corrupted lines produced by binary/encoding artifacts.
	if _replacement_char_ratio(line) > 0.05:
		return True

	# Remove repeated social/footer/navigation lines.
	token_hits = sum(1 for token in _NAV_TOKENS if token in lower)
	if token_hits >= 2:
		return True

	# Filter repeated menu bars with many short pipe-like fragments.
	if len(re.findall(r"\b(home|about|admissions|careers|alumni|blog)\b", lower)) >= 4:
		return True

	return False


def clean_text(text: str) -> str:
	"""Normalize text and remove noisy boilerplate/corrupted content."""
	cleaned = normalize_whitespace(text)
	lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
	filtered_lines = [line for line in lines if not _is_noise_line(line)]
	return normalize_whitespace("\n".join(filtered_lines))
