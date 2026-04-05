"""Group service layer for business logic and database operations."""

from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from bson import ObjectId
from bson.errors import InvalidId

from app.db.mongodb import get_database
from app.models.group import GroupModel, GroupMemberModel
from app.schemas.group import RoleEnum


def _to_object_id(value: Any) -> Optional[ObjectId]:
    """Convert an ID value to ObjectId when possible."""
    if isinstance(value, ObjectId):
        return value
    if value is None:
        return None
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError, ValueError):
        return None


def _id_filter(value: Any) -> Dict[str, Any]:
    """Build a Mongo filter for _id that tolerates non-ObjectId values."""
    object_id = _to_object_id(value)
    return {"_id": object_id if object_id is not None else value}


def _normalize_role(role: Union[RoleEnum, str]) -> Optional[str]:
    """Normalize incoming role values to one of the supported role strings."""
    if isinstance(role, RoleEnum):
        return role.value
    if isinstance(role, str):
        try:
            return RoleEnum(role).value
        except ValueError:
            return None
    return None


class GroupService:
    """Service class for group operations."""

    @staticmethod
    async def create_group(
        name: str,
        created_by: str,
        description: Optional[str] = None,
        avatar_url: Optional[str] = None,
        is_ai_enabled: bool = True,
        ai_auto_respond: bool = False,
        initial_members: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Create a new group with the creator as admin."""
        db = get_database()
        groups_collection = db[GroupModel.collection_name]
        members_collection = db[GroupMemberModel.collection_name]

        group_data = GroupModel.from_dict({
            "name": name,
            "description": description,
            "avatar_url": avatar_url,
            "created_by": created_by,
            "is_ai_enabled": is_ai_enabled,
            "ai_auto_respond": ai_auto_respond,
        })

        result = await groups_collection.insert_one(group_data)
        group_id = str(result.inserted_id)

        # Add creator as admin
        await GroupService.add_member(group_id, created_by, RoleEnum.ADMIN)

        # Add initial members if provided
        added_members = 0
        if initial_members:
            for member_id in initial_members:
                if member_id != created_by:  # Don't add creator twice
                    added = await GroupService.add_member(group_id, member_id, RoleEnum.MEMBER)
                    if added:
                        added_members += 1

        return {
            "id": group_id,
            "name": group_data["name"],
            "description": group_data.get("description"),
            "avatar_url": group_data.get("avatar_url"),
            "created_by": group_data["created_by"],
            "is_ai_enabled": group_data.get("is_ai_enabled", True),
            "ai_auto_respond": group_data.get("ai_auto_respond", False),
            "member_count": 1 + added_members,
            "created_at": group_data["created_at"],
            "updated_at": group_data["updated_at"],
        }

    @staticmethod
    async def get_group(group_id: str) -> Optional[Dict[str, Any]]:
        """Get a group by ID."""
        db = get_database()
        groups_collection = db[GroupModel.collection_name]

        group = await groups_collection.find_one(_id_filter(group_id))
        if not group:
            return None

        group_identifier = str(group.get("_id", group_id))

        # Get member count
        members_collection = db[GroupMemberModel.collection_name]
        member_count = await members_collection.count_documents({"group_id": group_identifier})

        return {
            "id": group_identifier,
            "name": group["name"],
            "description": group.get("description"),
            "avatar_url": group.get("avatar_url"),
            "created_by": group["created_by"],
            "is_ai_enabled": group.get("is_ai_enabled", True),
            "ai_auto_respond": group.get("ai_auto_respond", False),
            "member_count": member_count,
            "created_at": group["created_at"],
            "updated_at": group["updated_at"],
        }

    @staticmethod
    async def update_group(group_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a group's details."""
        db = get_database()
        groups_collection = db[GroupModel.collection_name]

        updates["updated_at"] = datetime.utcnow()

        result = await groups_collection.update_one(
            _id_filter(group_id),
            {"$set": updates}
        )

        if result.modified_count == 0:
            return None

        return await GroupService.get_group(group_id)

    @staticmethod
    async def delete_group(group_id: str) -> bool:
        """Delete a group and all associated data."""
        db = get_database()
        groups_collection = db[GroupModel.collection_name]
        members_collection = db[GroupMemberModel.collection_name]
        messages_collection = db["messages"]
        reactions_collection = db["message_reactions"]
        ai_context_collection = db["ai_context"]

        # Delete group
        result = await groups_collection.delete_one(_id_filter(group_id))

        if result.deleted_count == 0:
            return False

        # Fetch group message IDs before deleting messages so reactions can be removed too.
        message_documents = await messages_collection.find(
            {"group_id": group_id},
            {"_id": 1},
        ).to_list(length=None)
        message_ids = [str(doc["_id"]) for doc in message_documents if doc.get("_id") is not None]

        # Cascade delete related data
        await members_collection.delete_many({"group_id": group_id})
        await messages_collection.delete_many({"group_id": group_id})
        if message_ids:
            await reactions_collection.delete_many({"message_id": {"$in": message_ids}})
        await ai_context_collection.delete_one({"group_id": group_id})

        return True

    @staticmethod
    async def get_user_groups(user_id: str) -> List[Dict[str, Any]]:
        """Get all groups a user belongs to."""
        db = get_database()
        groups_collection = db[GroupModel.collection_name]
        members_collection = db[GroupMemberModel.collection_name]

        # Get all group IDs for this user
        memberships = await members_collection.find(
            {"user_id": user_id}
        ).to_list(length=None)

        group_ids = [m["group_id"] for m in memberships]
        object_group_ids = [_to_object_id(group_id) for group_id in group_ids]
        object_group_ids = [group_id for group_id in object_group_ids if group_id is not None]

        if not object_group_ids:
            return []

        # Get group details
        groups = await groups_collection.find(
            {"_id": {"$in": object_group_ids}}
        ).to_list(length=None)

        result = []
        for group in groups:
            group_identifier = str(group["_id"])
            member_count = await members_collection.count_documents({"group_id": group_identifier})
            result.append({
                "id": group_identifier,
                "name": group["name"],
                "description": group.get("description"),
                "avatar_url": group.get("avatar_url"),
                "created_by": group["created_by"],
                "is_ai_enabled": group.get("is_ai_enabled", True),
                "ai_auto_respond": group.get("ai_auto_respond", False),
                "member_count": member_count,
                "created_at": group["created_at"],
                "updated_at": group["updated_at"],
            })

        return result

    @staticmethod
    async def get_user_role_in_group(user_id: str, group_id: str) -> Optional[str]:
        """Get a user's role in a specific group."""
        db = get_database()
        members_collection = db[GroupMemberModel.collection_name]

        member = await members_collection.find_one({
            "group_id": group_id,
            "user_id": user_id,
        })

        return member["role"] if member else None

    @staticmethod
    async def add_member(group_id: str, user_id: str, role: RoleEnum = RoleEnum.MEMBER) -> bool:
        """Add a member to a group."""
        db = get_database()
        members_collection = db[GroupMemberModel.collection_name]

        # Check if already a member
        existing = await members_collection.find_one({
            "group_id": group_id,
            "user_id": user_id,
        })

        if existing:
            return False

        member_data = GroupMemberModel.from_dict({
            "group_id": group_id,
            "user_id": user_id,
            "role": role.value if isinstance(role, RoleEnum) else role,
        })

        await members_collection.insert_one(member_data)
        return True

    @staticmethod
    async def remove_member(group_id: str, user_id: str) -> bool:
        """Remove a member from a group."""
        db = get_database()
        members_collection = db[GroupMemberModel.collection_name]

        result = await members_collection.delete_one({
            "group_id": group_id,
            "user_id": user_id,
        })

        return result.deleted_count > 0

    @staticmethod
    async def change_member_role(group_id: str, user_id: str, new_role: RoleEnum) -> bool:
        """Change a member's role in a group."""
        db = get_database()
        members_collection = db[GroupMemberModel.collection_name]

        result = await members_collection.update_one(
            {"group_id": group_id, "user_id": user_id},
            {"$set": {"role": new_role.value if isinstance(new_role, RoleEnum) else new_role}}
        )

        return result.modified_count > 0

    @staticmethod
    async def get_group_members(group_id: str) -> List[Dict[str, Any]]:
        """Get all members of a group with their user details."""
        db = get_database()
        members_collection = db[GroupMemberModel.collection_name]
        users_collection = db["users"]

        memberships = await members_collection.find(
            {"group_id": group_id}
        ).to_list(length=None)

        members = []
        for membership in memberships:
            member_user_id = membership["user_id"]
            user = None

            user_object_id = _to_object_id(member_user_id)
            if user_object_id is not None:
                user = await users_collection.find_one({"_id": user_object_id})

            members.append({
                "user_id": member_user_id,
                "name": (user.get("name") if user else None) or (user.get("email") if user else None) or "Unknown",
                "avatar_url": (user.get("avatar_url") if user else None) or (user.get("profile_picture") if user else None),
                "role": membership["role"],
                "joined_at": membership["joined_at"],
            })

        return members

    @staticmethod
    async def is_member(group_id: str, user_id: str) -> bool:
        """Check if a user is a member of a group."""
        db = get_database()
        members_collection = db[GroupMemberModel.collection_name]

        member = await members_collection.find_one({
            "group_id": group_id,
            "user_id": user_id,
        })

        return member is not None

    @staticmethod
    async def has_permission(user_id: str, group_id: str, required_role: Union[RoleEnum, str]) -> bool:
        """Check if a user has at least the required role level."""
        role_hierarchy = {
            RoleEnum.ADMIN.value: 3,
            RoleEnum.MODERATOR.value: 2,
            RoleEnum.MEMBER.value: 1,
        }

        normalized_required_role = _normalize_role(required_role)
        if normalized_required_role is None:
            return False

        user_role_str = await get_user_role_in_group(user_id, group_id)
        if not user_role_str:
            return False

        normalized_user_role = _normalize_role(user_role_str)
        if normalized_user_role is None:
            return False

        return role_hierarchy.get(normalized_user_role, 0) >= role_hierarchy.get(normalized_required_role, 0)


async def get_user_role_in_group(user_id: str, group_id: str) -> Optional[str]:
    """Module-level alias kept for compatibility with tests and patching."""
    return await GroupService.get_user_role_in_group(user_id, group_id)
