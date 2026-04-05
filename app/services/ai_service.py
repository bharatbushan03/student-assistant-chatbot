"""AI service for group conversation intelligence and context management."""

import re
from datetime import datetime
from typing import List, Optional, Dict, Any
from bson import ObjectId

from app.db.mongodb import get_database
from app.models.group import AIContextModel
from app.services.llm import get_llm_client


class AIService:
    """Service class for AI-powered group conversation features."""

    # AI user ID placeholder (used to identify AI messages)
    AI_USER_ID = "ai-assistant"
    AI_USER_NAME = "AI Assistant"
    AI_USER_AVATAR = "/static/ai-avatar.png"

    # Tags that trigger AI response
    AI_TAGS = ["@AI", "@Assistant", "@Bot", "@ai", "@assistant", "@bot"]

    # Maximum context messages to keep
    MAX_CONTEXT_MESSAGES = 20

    @staticmethod
    def is_tagged(content: str) -> bool:
        """Check if message explicitly tags the AI."""
        for tag in AIService.AI_TAGS:
            if tag in content:
                return True
        return False

    @staticmethod
    def is_question(content: str) -> bool:
        """Check if message is a question (for auto-respond mode)."""
        question_indicators = ["what", "how", "why", "when", "where", "who", "which", "can you", "could you"]
        content_lower = content.lower().strip()

        # Direct question mark
        if content_lower.endswith("?"):
            return True

        # Question words
        return any(word in content_lower for word in question_indicators)

    @staticmethod
    async def should_respond(
        message: Dict[str, Any],
        group: Dict[str, Any],
        is_reply_to_ai: bool = False,
    ) -> bool:
        """Determine if AI should respond to a message."""

        # AI disabled for this group
        if not group.get("is_ai_enabled", True):
            return False

        # Don't respond to AI's own messages
        if message.get("sender_id") == AIService.AI_USER_ID:
            return False

        content = message.get("content", "")

        # 1. Explicit tag (@AI, @Assistant, etc.)
        if AIService.is_tagged(content):
            return True

        # 2. Reply to an AI message
        if is_reply_to_ai:
            return True

        # 3. Auto-respond mode enabled
        if group.get("ai_auto_respond", False):
            return AIService.is_question(content)

        return False

    @staticmethod
    async def get_context(group_id: str, limit: int = MAX_CONTEXT_MESSAGES) -> List[Dict[str, Any]]:
        """Retrieve conversation context for AI."""
        db = get_database()
        messages_collection = db["messages"]

        # Get recent messages
        cursor = messages_collection.find(
            {"group_id": group_id}
        ).sort("created_at", -1).limit(limit)

        messages = await cursor.to_list(length=None)

        # Format for LLM context
        context = []
        for msg in reversed(messages):  # Reverse to get chronological order
            role = "assistant" if msg.get("sender_id") == AIService.AI_USER_ID else "user"
            context.append({
                "role": role,
                "content": f"{msg.get('sender_name', 'Unknown')}: {msg['content']}",
                "timestamp": msg.get("created_at", datetime.utcnow()).isoformat(),
            })

        return context

    @staticmethod
    async def update_context(group_id: str, message: Dict[str, Any]) -> None:
        """Update the AI context window with a new message."""
        db = get_database()
        ai_context_collection = db[AIContextModel.collection_name]

        # Get existing context
        context_doc = await ai_context_collection.find_one({"group_id": group_id})

        context_entry = {
            "role": "assistant" if message.get("sender_id") == AIService.AI_USER_ID else "user",
            "content": f"{message.get('sender_name', 'Unknown')}: {message['content']}",
            "timestamp": message.get("created_at", datetime.utcnow()).isoformat(),
        }

        if context_doc:
            # Append and trim to MAX_CONTEXT_MESSAGES
            context_window = context_doc.get("context_window", [])
            context_window.append(context_entry)

            if len(context_window) > AIService.MAX_CONTEXT_MESSAGES:
                context_window = context_window[-AIService.MAX_CONTEXT_MESSAGES:]

            await ai_context_collection.update_one(
                {"group_id": group_id},
                {
                    "$set": {
                        "context_window": context_window,
                        "last_updated": datetime.utcnow(),
                    }
                }
            )
        else:
            # Create new context document
            await ai_context_collection.insert_one(
                AIContextModel.from_dict({
                    "group_id": group_id,
                    "context_window": [context_entry],
                })
            )

    @staticmethod
    async def generate_response(
        group_id: str,
        user_message: str,
        context: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """Generate an AI response based on context and user message."""

        if context is None:
            context = await AIService.get_context(group_id)

        # Build prompt
        system_prompt = """You are an AI assistant participating in a group chat for a college student community.
Your role is to:
- Be helpful, friendly, and concise
- Provide accurate information when asked
- Summarize conversations when requested
- Answer questions about college, studies, and general topics
- Maintain a professional but approachable tone
- Avoid interrupting natural human conversation flow

Keep responses under 150 words unless specifically asked for more detail."""

        # Format context
        context_text = "\n".join([
            f"[{msg.get('timestamp', '')[:19]}] {msg['content']}"
            for msg in context[-15:]  # Use last 15 messages for context
        ])

        # Call LLM
        try:
            llm = get_llm_client()
            messages = [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": f"""Recent conversation context:
{context_text}

Latest message to respond to: {user_message}

Respond naturally to continue the conversation.""",
                },
            ]
            response = llm.generate(messages, max_tokens=220, temperature=0.7)

            # Clean response
            response = response.strip()

            # Remove any AI tags from response
            for tag in AIService.AI_TAGS:
                response = response.replace(tag + ":", "").replace(tag, "").strip()

            return response

        except Exception as e:
            return f"I apologize, but I'm having trouble responding right now. Please try again in a moment. (Error: {str(e)})"

    @staticmethod
    async def summarize_conversation(
        group_id: str,
        message_count: int = 20,
    ) -> Dict[str, Any]:
        """Generate a summary of recent conversation."""
        context = await AIService.get_context(group_id, limit=message_count)

        if not context:
            return {
                "summary": "No conversation to summarize.",
                "key_points": [],
                "generated_at": datetime.utcnow(),
            }

        system_prompt = """You are an expert conversation summarizer.
Provide a concise summary with key bullet points."""

        context_text = "\n".join([
            f"[{msg.get('timestamp', '')[:19]}] {msg['content']}"
            for msg in context
        ])

        try:
            llm = get_llm_client()
            messages = [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": f"""Conversation:
{context_text}

Provide:
1. A 2-3 sentence summary
2. 3-5 key bullet points of important information discussed

Format:
SUMMARY: [your summary]
KEY POINTS:
- [point 1]
- [point 2]
- [point 3]""",
                },
            ]
            response = llm.generate(messages, max_tokens=320, temperature=0.4)

            # Parse response
            summary = ""
            key_points = []

            if "SUMMARY:" in response:
                summary_part = response.split("SUMMARY:")[1]
                if "KEY POINTS:" in summary_part:
                    summary = summary_part.split("KEY POINTS:")[0].strip()
                    points_text = summary_part.split("KEY POINTS:")[1]
                    key_points = [
                        line.strip().lstrip("-").strip()
                        for line in points_text.strip().split("\n")
                        if line.strip().startswith("-") or line.strip()
                    ]
                else:
                    summary = summary_part.strip()
            else:
                summary = response.strip()

            return {
                "summary": summary,
                "key_points": key_points[:5],  # Max 5 points
                "generated_at": datetime.utcnow(),
            }

        except Exception as e:
            return {
                "summary": "Unable to generate summary at this time.",
                "key_points": [],
                "generated_at": datetime.utcnow(),
                "error": str(e),
            }

    @staticmethod
    async def moderate_content(content: str) -> Dict[str, Any]:
        """Check content for potentially harmful material."""
        # Basic profanity filter (can be enhanced with AI)
        profanity_patterns = [
            r"\b(spam|scam|fraud)\b",
            r"\b(hate|racist|sexist)\b",
        ]

        flags = []
        for pattern in profanity_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                flags.append("potentially_harmful")
                break

        # Check for links (potential phishing)
        if re.search(r"https?://[^\s]+", content):
            flags.append("contains_link")

        return {
            "is_safe": len(flags) == 0,
            "flags": flags,
            "action": "allow" if len(flags) == 0 else "review",
        }
