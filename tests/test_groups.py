"""Tests for group conversation system."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

# ── Group Service Tests ──────────────────────────────────────────────


class TestGroupService:
    """Test group service operations."""

    @pytest.mark.asyncio
    async def test_create_group(self):
        """Test creating a new group."""
        from app.services.group_service import GroupService

        with patch("app.services.group_service.get_database") as mock_get_db:
            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db

            mock_groups_collection = AsyncMock()
            mock_members_collection = AsyncMock()
            mock_db.__getitem__.side_effect = lambda name: {
                "groups": mock_groups_collection,
                "group_members": mock_members_collection,
            }[name]

            mock_groups_collection.insert_one.return_value = MagicMock(inserted_id="test-group-id")

            group = await GroupService.create_group(
                name="Test Group",
                created_by="user-123",
                description="A test group",
            )

            assert group["name"] == "Test Group"
            assert group["created_by"] == "user-123"
            mock_groups_collection.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_group(self):
        """Test retrieving a group by ID."""
        from app.services.group_service import GroupService

        with patch("app.services.group_service.get_database") as mock_get_db:
            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db

            mock_groups_collection = AsyncMock()
            mock_members_collection = AsyncMock()
            mock_db.__getitem__.side_effect = lambda name: {
                "groups": mock_groups_collection,
                "group_members": mock_members_collection,
            }[name]

            mock_groups_collection.find_one.return_value = {
                "_id": "test-group-id",
                "name": "Test Group",
                "created_by": "user-123",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }

            mock_members_collection.count_documents.return_value = 5

            group = await GroupService.get_group("test-group-id")

            assert group is not None
            assert group["name"] == "Test Group"
            assert group["member_count"] == 5

    @pytest.mark.asyncio
    async def test_add_member(self):
        """Test adding a member to a group."""
        from app.services.group_service import GroupService
        from app.schemas.group import RoleEnum

        with patch("app.services.group_service.get_database") as mock_get_db:
            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_members_collection = AsyncMock()
            mock_db.__getitem__.return_value = mock_members_collection

            mock_members_collection.find_one.return_value = None  # Not already a member
            mock_members_collection.insert_one.return_value = None

            result = await GroupService.add_member(
                "test-group-id",
                "user-456",
                RoleEnum.MEMBER,
            )

            assert result is True
            mock_members_collection.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_remove_member(self):
        """Test removing a member from a group."""
        from app.services.group_service import GroupService

        with patch("app.services.group_service.get_database") as mock_get_db:
            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_members_collection = AsyncMock()
            mock_db.__getitem__.return_value = mock_members_collection

            mock_members_collection.delete_one.return_value = MagicMock(deleted_count=1)

            result = await GroupService.remove_member("test-group-id", "user-456")

            assert result is True
            mock_members_collection.delete_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_has_permission_admin(self):
        """Test permission check for admin."""
        from app.services.group_service import GroupService
        from app.schemas.group import RoleEnum

        with patch("app.services.group_service.get_user_role_in_group", return_value="admin"):
            result = await GroupService.has_permission("user-123", "group-123", RoleEnum.ADMIN)
            assert result is True

    @pytest.mark.asyncio
    async def test_has_permission_member_cannot_add_members(self):
        """Test that members cannot add other members."""
        from app.services.group_service import GroupService
        from app.schemas.group import RoleEnum

        with patch("app.services.group_service.get_user_role_in_group", return_value="member"):
            result = await GroupService.has_permission("user-123", "group-123", RoleEnum.MODERATOR)
            assert result is False


# ── Message Service Tests ────────────────────────────────────────────


class TestMessageService:
    """Test message service operations."""

    @pytest.mark.asyncio
    async def test_create_message(self):
        """Test creating a new message."""
        from app.services.message_service import MessageService

        with patch("app.services.message_service.get_database") as mock_get_db:
            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_messages_collection = AsyncMock()
            mock_db.__getitem__.return_value = mock_messages_collection

            mock_messages_collection.insert_one.return_value = MagicMock(inserted_id="msg-123")
            mock_messages_collection.find_one.return_value = {
                "_id": "msg-123",
                "group_id": "group-123",
                "sender_id": "user-123",
                "sender_name": "Test User",
                "content": "Hello, world!",
                "message_type": "text",
                "created_at": datetime.utcnow(),
            }

            message = await MessageService.create_message(
                group_id="group-123",
                sender_id="user-123",
                sender_name="Test User",
                sender_avatar=None,
                content="Hello, world!",
            )

            assert message is not None
            assert message["content"] == "Hello, world!"
            mock_messages_collection.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_message(self):
        """Test updating a message."""
        from app.services.message_service import MessageService

        with patch("app.services.message_service.get_database") as mock_get_db:
            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_messages_collection = AsyncMock()
            mock_db.__getitem__.return_value = mock_messages_collection

            mock_messages_collection.update_one.return_value = MagicMock(modified_count=1)
            mock_messages_collection.find_one.return_value = {
                "_id": "msg-123",
                "group_id": "group-123",
                "content": "Updated content",
                "is_edited": True,
                "edited_at": datetime.utcnow(),
                "created_at": datetime.utcnow(),
            }

            message = await MessageService.update_message("msg-123", "Updated content")

            assert message is not None
            assert message["is_edited"] is True

    @pytest.mark.asyncio
    async def test_add_reaction(self):
        """Test adding a reaction to a message."""
        from app.services.message_service import MessageService

        with patch("app.services.message_service.get_database") as mock_get_db:
            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_reactions_collection = AsyncMock()
            mock_db.__getitem__.return_value = mock_reactions_collection

            mock_reactions_collection.find_one.return_value = None  # No existing reaction
            mock_reactions_collection.insert_one.return_value = None

            result = await MessageService.add_reaction("msg-123", "user-123", "👍")

            assert result is True
            mock_reactions_collection.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_messages(self):
        """Test searching messages."""
        from app.services.message_service import MessageService

        with patch("app.services.message_service.get_database") as mock_get_db:
            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_messages_collection = AsyncMock()
            mock_db.__getitem__.return_value = mock_messages_collection

            mock_cursor = AsyncMock()
            mock_cursor.to_list.return_value = [
                {
                    "_id": "msg-123",
                    "group_id": "group-123",
                    "content": "Hello world",
                    "sender_name": "Test User",
                    "created_at": datetime.utcnow(),
                }
            ]
            mock_messages_collection.find.return_value.sort.return_value.limit.return_value = mock_cursor

            messages = await MessageService.search_messages("group-123", "hello")

            assert len(messages) == 1
            assert "hello" in messages[0]["content"].lower()


# ── AI Service Tests ─────────────────────────────────────────────────


class TestAIService:
    """Test AI service operations."""

    def test_is_tagged(self):
        """Test AI tag detection."""
        from app.services.ai_service import AIService

        assert AIService.is_tagged("@AI help me") is True
        assert AIService.is_tagged("@Assistant what's up") is True
        assert AIService.is_tagged("Hello everyone") is False

    def test_is_question(self):
        """Test question detection."""
        from app.services.ai_service import AIService

        assert AIService.is_question("What is the answer?") is True
        assert AIService.is_question("How does this work") is True
        assert AIService.is_question("This is a statement.") is False

    @pytest.mark.asyncio
    async def test_should_respond_when_tagged(self):
        """Test AI responds when tagged."""
        from app.services.ai_service import AIService

        message = {"sender_id": "user-123", "content": "@AI can you help?"}
        group = {"is_ai_enabled": True, "ai_auto_respond": False}

        result = await AIService.should_respond(message, group)
        assert result is True

    @pytest.mark.asyncio
    async def test_should_respond_when_ai_disabled(self):
        """Test AI does not respond when disabled."""
        from app.services.ai_service import AIService

        message = {"sender_id": "user-123", "content": "@AI help"}
        group = {"is_ai_enabled": False}

        result = await AIService.should_respond(message, group)
        assert result is False

    @pytest.mark.asyncio
    async def test_should_respond_in_auto_mode(self):
        """Test AI responds to questions in auto mode."""
        from app.services.ai_service import AIService

        message = {"sender_id": "user-123", "content": "What is the deadline?"}
        group = {"is_ai_enabled": True, "ai_auto_respond": True}

        result = await AIService.should_respond(message, group)
        assert result is True

    @pytest.mark.asyncio
    async def test_moderate_content_safe(self):
        """Test content moderation for safe content."""
        from app.services.ai_service import AIService

        result = await AIService.moderate_content("Hello, how are you?")
        assert result["is_safe"] is True
        assert result["action"] == "allow"

    @pytest.mark.asyncio
    async def test_moderate_content_with_link(self):
        """Test content moderation flags links."""
        from app.services.ai_service import AIService

        result = await AIService.moderate_content("Check out https://example.com")
        assert "contains_link" in result["flags"]


# ── Permission Tests ─────────────────────────────────────────────────


class TestPermissions:
    """Test role-based access control."""

    @pytest.mark.asyncio
    async def test_admin_can_delete_group(self):
        """Test admin can delete group."""
        from app.services.group_service import GroupService
        from app.schemas.group import RoleEnum

        with patch("app.services.group_service.get_user_role_in_group", return_value="admin"):
            result = await GroupService.has_permission("user-123", "group-123", RoleEnum.ADMIN)
            assert result is True

    @pytest.mark.asyncio
    async def test_moderator_cannot_delete_group(self):
        """Test moderator cannot delete group."""
        from app.services.group_service import GroupService
        from app.schemas.group import RoleEnum

        with patch("app.services.group_service.get_user_role_in_group", return_value="moderator"):
            result = await GroupService.has_permission("user-123", "group-123", RoleEnum.ADMIN)
            assert result is False

    @pytest.mark.asyncio
    async def test_moderator_can_delete_messages(self):
        """Test moderator can delete messages."""
        from app.services.group_service import GroupService
        from app.schemas.group import RoleEnum

        with patch("app.services.group_service.get_user_role_in_group", return_value="moderator"):
            result = await GroupService.has_permission("user-123", "group-123", RoleEnum.MODERATOR)
            assert result is True

    @pytest.mark.asyncio
    async def test_member_cannot_delete_messages(self):
        """Test member cannot delete others' messages."""
        from app.services.group_service import GroupService
        from app.schemas.group import RoleEnum

        with patch("app.services.group_service.get_user_role_in_group", return_value="member"):
            result = await GroupService.has_permission("user-123", "group-123", RoleEnum.MODERATOR)
            assert result is False
