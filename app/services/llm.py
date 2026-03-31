from functools import lru_cache
from typing import Optional

import requests
from openai import OpenAI

from app.config.settings import get_settings


class LLMClient:
	"""Wrapper around either OpenAI or HuggingFace Inference API."""

	def __init__(self):
		settings = get_settings()
		self.provider: str
		self.hf_model = settings.huggingface_model
		self._hf_token = settings.huggingface_api_token

		if settings.openai_api_key:
			self.provider = "openai"
			self.model = settings.openai_model
			self.client = OpenAI(api_key=settings.openai_api_key)
		elif settings.huggingface_api_token:
			self.provider = "huggingface"
			self.model = self.hf_model
			self.client = None
		else:
			raise ValueError("Set OPENAI_API_KEY or HUGGINGFACEHUB_API_TOKEN in .env")

	def generate(self, prompt: str, max_tokens: int = 300, temperature: float = 0.7) -> str:
		if self.provider == "openai":
			response = self.client.chat.completions.create(
				model=self.model,
				messages=[{"role": "user", "content": prompt}],
				max_tokens=max_tokens,
				temperature=temperature,
			)
			return response.choices[0].message.content.strip()

		return self._generate_huggingface(prompt, max_tokens, temperature)

	def _generate_huggingface(self, prompt: str, max_tokens: int, temperature: float) -> str:
		headers = {"Authorization": f"Bearer {self._hf_token}"}
		payload = {
			"inputs": prompt,
			"parameters": {"max_new_tokens": max_tokens, "temperature": temperature},
		}
		response = requests.post(
			f"https://api-inference.huggingface.co/models/{self.hf_model}",
			headers=headers,
			json=payload,
			timeout=60,
		)
		response.raise_for_status()
		data = response.json()

		if isinstance(data, list) and data and "generated_text" in data[0]:
			return data[0]["generated_text"].strip()
		if isinstance(data, dict) and "generated_text" in data:
			return str(data["generated_text"]).strip()
		return str(data)


@lru_cache(maxsize=1)
def get_llm_client() -> LLMClient:
	return LLMClient()
