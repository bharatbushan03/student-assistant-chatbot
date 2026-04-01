"""LLM client supporting OpenAI and HuggingFace API."""

import logging
from functools import lru_cache

from openai import OpenAI
from huggingface_hub import InferenceClient

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


class LLMClient:
    """Wrapper around either OpenAI or HuggingFace Inference Client."""

    def __init__(self):
        settings = get_settings()
        self.provider: str
        self._hf_token = settings.huggingface_api_token
        hf_model = settings.huggingface_model or "Qwen/Qwen2.5-72B-Instruct"

        if settings.openai_api_key:
            self.provider = "openai"
            self.model = settings.openai_model
            self.client = OpenAI(api_key=settings.openai_api_key)
        elif settings.huggingface_api_token:
            self.provider = "huggingface"
            self.model = hf_model
            # Use the official InferenceClient which handles new router subdomains automatically
            self.client = InferenceClient(model=self.model, token=self._hf_token)
        else:
            raise ValueError("Set OPENAI_API_KEY or HUGGINGFACEHUB_API_TOKEN in .env")

        logger.info("LLM provider: %s  model: %s", self.provider, self.model)

    def generate(self, messages: list, max_tokens: int = 300, temperature: float = 0.7) -> str:
        """Generate a response from the configured LLM."""
        if self.provider == "openai":
            return self._generate_openai(messages, max_tokens, temperature)
        return self._generate_huggingface(messages, max_tokens, temperature)

    # ── OpenAI ────────────────────────────────────────────────────────
    def _generate_openai(self, messages: list, max_tokens: int, temperature: float) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content.strip()
        except Exception as exc:
            logger.error("OpenAI API error: %s", exc)
            raise RuntimeError(f"LLM request failed: {exc}") from exc

    # ── HuggingFace ───────────────────────────────────────────────────
    def _generate_huggingface(self, messages: list, max_tokens: int, temperature: float) -> str:
        try:
            # InferenceClient uses conversational chat_completion endpoint
            response = self.client.chat_completion(
                messages=messages, 
                max_tokens=max_tokens,
                temperature=max(temperature, 0.01) # HF rejects exactly 0
            )
            return response.choices[0].message.content.strip()
            
        except Exception as exc:
            logger.error("HuggingFace API error: %s", exc)
            if "503" in str(exc) or "loading" in str(exc).lower():
                raise RuntimeError("The AI model is currently loading on HuggingFace. Please wait a moment and try again.")
            raise RuntimeError("The AI model is taking too long to respond or is unavailable. Please try again.") from exc


@lru_cache(maxsize=1)
def get_llm_client() -> LLMClient:
    return LLMClient()
