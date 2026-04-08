"""LLM client powered by LangChain OpenAI."""

import logging
from functools import lru_cache

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


class LLMClient:
    """Wrapper around LangChain ChatOpenAI."""

    def __init__(self):
        settings = get_settings()
        if not settings.openai_api_key:
            raise ValueError("Set OPENAI_API_KEY in .env")

        self.provider = "langchain_openai"
        self.model = settings.openai_model or "gpt-4o-mini"
        self.client = ChatOpenAI(
            model=self.model,
            api_key=settings.openai_api_key,
            temperature=0,
        )

        logger.info("LLM provider: %s  model: %s", self.provider, self.model)

    def generate(self, messages: list, max_tokens: int = 300, temperature: float = 0.7) -> str:
        """Generate a response from the configured LLM."""
        return self._generate_langchain_openai(messages, max_tokens, temperature)

    # ── LangChain OpenAI ──────────────────────────────────────────────
    def _generate_langchain_openai(self, messages: list, max_tokens: int, temperature: float) -> str:
        try:
            lc_messages = self._to_langchain_messages(messages)
            response = self.client.bind(
                max_tokens=max_tokens,
                temperature=temperature,
            ).invoke(lc_messages)
            return self._extract_response_text(getattr(response, "content", ""))
        except Exception as exc:
            logger.error("LangChain OpenAI API error: %s", exc)
            error_text = str(exc).lower()
            if "401" in error_text or "invalid api key" in error_text or "authentication" in error_text:
                raise RuntimeError("OPENAI_API_KEY is invalid or missing required permissions.") from exc
            if "404" in error_text and "model" in error_text:
                raise RuntimeError(
                    f"Configured OpenAI model '{self.model}' is unavailable. "
                    "Set OPENAI_MODEL in .env to a valid model like 'gpt-4o-mini'."
                ) from exc
            if "429" in error_text or "quota" in error_text or "rate limit" in error_text:
                raise RuntimeError(
                    "OpenAI quota is exhausted or rate limited. Please retry later."
                ) from exc
            raise RuntimeError("The AI model is unavailable right now. Please try again.") from exc

    @staticmethod
    def _content_to_text(content) -> str:
        """Normalize OpenAI/LangChain content payloads to plain text."""
        if isinstance(content, list):
            text_parts = []
            for part in content:
                if isinstance(part, dict):
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
        text = cls._content_to_text(content)
        if text:
            return text

        raise RuntimeError("OpenAI returned an empty response.")


@lru_cache(maxsize=1)
def get_llm_client() -> LLMClient:
    return LLMClient()
