"""LLM client for NVIDIA Nemotron via the NVIDIA NIM OpenAI-compatible API."""

import logging
import re
from functools import lru_cache

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config.settings import get_settings

logger = logging.getLogger(__name__)

_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_REASONING_PART_TYPES = {"reasoning", "thinking", "reasoning_content"}


def strip_model_reasoning(text: str) -> str:
    """Drop Nemotron thinking traces so chat answers stay readable."""
    if not text:
        return ""

    cleaned = _THINK_BLOCK.sub("", text)
    lower = cleaned.lower()
    open_at = lower.rfind("<think>")
    if open_at != -1 and "</think>" not in lower[open_at:]:
        cleaned = cleaned[:open_at]
    return cleaned.strip()


class LLMClient:
    """Wrapper around NVIDIA Nemotron served through an OpenAI-compatible endpoint."""

    def __init__(self):
        settings = get_settings()
        if not settings.nvidia_api_key:
            raise ValueError("Set NVIDIA_API_KEY in .env")

        self.provider = "nvidia_nemotron"
        self.model = settings.nvidia_model or "nvidia/nemotron-3-super-120b-a12b"
        base_url = settings.nvidia_base_url.rstrip("/")
        self.client = ChatOpenAI(
            model=self.model,
            api_key=settings.nvidia_api_key,
            base_url=base_url,
            temperature=0.2,
            max_retries=2,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )
        self.fallback_client = ChatOpenAI(
            model=self.model,
            api_key=settings.nvidia_api_key,
            base_url=base_url,
            temperature=0.2,
            max_retries=1,
        )

        logger.info("LLM provider: %s  model: %s", self.provider, self.model)

    def generate(self, messages: list, max_tokens: int = 800, temperature: float = 0.2) -> str:
        """Generate a response from NVIDIA Nemotron."""
        try:
            return self._complete(self.client, messages, max_tokens, temperature)
        except RuntimeError as exc:
            if "400" not in str(exc):
                raise
            logger.warning("Retrying Nemotron without thinking controls: %s", exc)
            return self._complete(self.fallback_client, messages, max_tokens, temperature)

    def _complete(self, client, messages: list, max_tokens: int, temperature: float) -> str:
        try:
            lc_messages = self._to_langchain_messages(messages)
            response = client.bind(
                max_tokens=max(max_tokens, 512),
                temperature=temperature,
            ).invoke(lc_messages)
            text = strip_model_reasoning(self._extract_response_text(getattr(response, "content", "")))
            if not text:
                raise RuntimeError("NVIDIA Nemotron returned an empty response.")
            return text
        except RuntimeError:
            raise
        except Exception as exc:
            logger.error("NVIDIA Nemotron API error: %s", exc)
            error_text = str(exc).lower()
            if "401" in error_text or "invalid api key" in error_text or "authentication" in error_text:
                raise RuntimeError("NVIDIA_API_KEY is invalid or missing required permissions.") from exc
            if "404" in error_text and "model" in error_text:
                raise RuntimeError(
                    f"Configured NVIDIA model '{self.model}' is unavailable. "
                    "Set NVIDIA_MODEL in .env to a model such as 'nvidia/nemotron-3-super-120b-a12b'."
                ) from exc
            if "429" in error_text or "quota" in error_text or "rate limit" in error_text:
                raise RuntimeError("NVIDIA quota is exhausted or rate limited. Please retry later.") from exc
            if "400" in error_text:
                raise RuntimeError(f"NVIDIA request was rejected (400): {exc}") from exc
            raise RuntimeError("The AI model is unavailable right now. Please try again.") from exc

    @staticmethod
    def _content_to_text(content) -> str:
        """Normalize NIM/LangChain content payloads to plain text."""
        if isinstance(content, list):
            text_parts = []
            for part in content:
                if isinstance(part, dict):
                    part_type = str(part.get("type") or "").strip().lower()
                    if part_type in _REASONING_PART_TYPES:
                        continue
                    text = part.get("text") or part.get("content")
                    if text:
                        text_parts.append(str(text))
                elif part is not None:
                    text_parts.append(str(part))
            return "\n".join(text_parts).strip()

        if content is None:
            return ""

        return str(content).strip()

    @classmethod
    def _to_langchain_messages(cls, messages: list):
        """Convert role-based chat messages into LangChain message objects."""
        converted = []

        for msg in messages or []:
            if isinstance(msg, dict):
                role = str(msg.get("role", "user")).strip().lower()
                content_text = cls._content_to_text(msg.get("content", ""))
            else:
                role = "user"
                content_text = cls._content_to_text(msg)

            if not content_text:
                continue

            if role == "system":
                converted.append(SystemMessage(content=content_text))
            elif role == "assistant":
                converted.append(AIMessage(content=content_text))
            else:
                converted.append(HumanMessage(content=content_text))

        if not converted:
            converted.append(HumanMessage(content="Please answer the request."))

        return converted

    @classmethod
    def _extract_response_text(cls, content) -> str:
        return cls._content_to_text(content)


@lru_cache(maxsize=1)
def get_llm_client() -> LLMClient:
    return LLMClient()
