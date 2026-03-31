import requests


def fetch_page(url: str, timeout: int = 15) -> str:
	"""Fetch a single web page and return its text content."""
	response = requests.get(url, timeout=timeout)
	response.raise_for_status()
	return response.text
