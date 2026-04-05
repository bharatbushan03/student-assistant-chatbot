# Group Conversation System - Documentation

## Overview

The Group Conversation System enables real-time multi-user chat with AI integration for the MIETY AI platform. Users can create groups, invite members, send messages, and interact with an AI assistant that participates in conversations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT                                      │
│  (React Frontend with Socket.IO Client)                             │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTPS + WSS
┌─────────────────────────────▼───────────────────────────────────────┐
│                      FastAPI Application                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │  REST Routes    │  │  Socket.IO      │  │  Services           │  │
│  │  /api/groups    │  │  /socket.io     │  │  - GroupService     │  │
│  │  /api/groups/{group_id}/messages │  │ (WebSocket) │  │  - MessageService   │  │
│  └─────────────────┘  └─────────────────┘  │  - AIService        │  │
│                                            └─────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                      MongoDB (Motor - Async)                        │
│  Collections: groups, group_members, messages,                      │
│             message_reactions, ai_context                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Features

### Core Features (MVP)

| Feature | Description | Status |
|---------|-------------|--------|
| Group Creation | Create groups with name, description, avatar | Implemented |
| Role-Based Access | Admin/Mod/Member hierarchy | Implemented |
| Real-Time Messaging | WebSocket-based message delivery | Implemented |
| AI Participant | AI responds when tagged or in auto-mode | Implemented |
| Message History | Paginated message retrieval | Implemented |
| Member Management | Add/remove members, change roles | Implemented |
| Typing Indicators | Real-time typing status | Implemented |
| Read Receipts | Per-user message read tracking | Implemented |
| Message Reactions | Emoji reactions on messages | Implemented |
| Search | Full-text search in messages | Implemented |

### Advanced Features (Post-MVP)

| Feature | Description | Priority |
|---------|-------------|----------|
| Threaded Replies | Slack-style nested conversations | P2 |
| File/Image Sharing | Upload and preview files | P2 |
| Voice Messages | Audio message recording | P3 |
| Polls | Interactive group polls | P3 |
| AI Auto-Summary | Automatic conversation summaries | P2 |
| Message Pinning | Pin important messages | P2 |
| Moderation Filters | Auto-flag harmful content | P2 |

---

## API Reference

### Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

### Groups

#### Create Group
```http
POST /api/groups
Content-Type: application/json
Authorization: Bearer <token>

{
    "name": "Project Team",
    "description": "Development team chat",
    "avatar_url": "https://...",
    "member_ids": ["user-1", "user-2"],
    "is_ai_enabled": true,
    "ai_auto_respond": false
}
```

#### List User's Groups
```http
GET /api/groups
Authorization: Bearer <token>
```

#### Get Group Details
```http
GET /api/groups/{group_id}
Authorization: Bearer <token>
```

#### Update Group
```http
PUT /api/groups/{group_id}
Content-Type: application/json
Authorization: Bearer <token>

{
    "name": "Updated Name",
    "description": "New description"
}
```

#### Delete Group
```http
DELETE /api/groups/{group_id}
Authorization: Bearer <token>
```

---

### Members

#### List Members
```http
GET /api/groups/{group_id}/members
Authorization: Bearer <token>
```

#### Add Members
```http
POST /api/groups/{group_id}/members
Content-Type: application/json
Authorization: Bearer <token>

{
    "user_ids": ["user-3", "user-4"],
    "role": "member"
}
```

#### Remove Member
```http
DELETE /api/groups/{group_id}/members/{user_id}
Authorization: Bearer <token>
```

#### Change Role
```http
PUT /api/groups/{group_id}/members/{user_id}/role
Content-Type: application/json
Authorization: Bearer <token>

{
    "role": "moderator"
}
```

#### Leave Group
```http
POST /api/groups/{group_id}/leave
Authorization: Bearer <token>
```

---

### Messages

#### Get Message History
```http
GET /api/groups/{group_id}/messages?limit=50&before=2026-04-05T10:00:00Z
Authorization: Bearer <token>
```

#### Edit Message
```http
PUT /api/groups/{group_id}/messages/{message_id}
Content-Type: application/json
Authorization: Bearer <token>

{
    "content": "Updated message content"
}
```

#### Delete Message
```http
DELETE /api/groups/{group_id}/messages/{message_id}
Authorization: Bearer <token>
```

#### Search Messages
```http
GET /api/groups/{group_id}/search?q=keyword&limit=20
Authorization: Bearer <token>
```

---

### Reactions

#### Add Reaction
```http
POST /api/groups/{group_id}/messages/{message_id}/reactions
Content-Type: application/json
Authorization: Bearer <token>

{
    "emoji": "👍"
}
```

#### Remove Reaction
```http
DELETE /api/groups/{group_id}/messages/{message_id}/reactions/{emoji}
Authorization: Bearer <token>
```

#### Get Reactions
```http
GET /api/groups/{group_id}/messages/{message_id}/reactions
Authorization: Bearer <token>
```

---

### AI

#### Configure AI
```http
POST /api/groups/{group_id}/ai/configure
Content-Type: application/json
Authorization: Bearer <token>

{
    "is_ai_enabled": true,
    "ai_auto_respond": false
}
```

#### Get Conversation Summary
```http
POST /api/groups/{group_id}/ai/summarize
Content-Type: application/json
Authorization: Bearer <token>

{
    "message_count": 20
}
```

#### Get AI Context
```http
GET /api/groups/{group_id}/ai/context
Authorization: Bearer <token>
```

---

## WebSocket Events

### Connection

```javascript
// Connect with authentication
const socket = io('http://localhost:10000', {
    auth: { token: jwtToken }
});

socket.on('connect', () => {
    console.log('Connected:', socket.id);
});

socket.on('error', (error) => {
    console.error('Connection error:', error);
});
```

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `join_group` | `{ group_id: string }` | Join a group room |
| `leave_group` | `{ group_id: string }` | Leave a group room |
| `send_message` | `{ group_id, content, type, reply_to_id, metadata }` | Send message |
| `typing_start` | `{ group_id: string }` | Start typing |
| `typing_stop` | `{ group_id: string }` | Stop typing |
| `mark_read` | `{ group_id, message_ids: string[] }` | Mark messages read |
| `add_reaction` | `{ message_id, emoji: string }` | Add reaction |
| `remove_reaction` | `{ message_id, emoji: string }` | Remove reaction |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message_created` | `{ message, group_id }` | New message |
| `message_updated` | `{ message_id, content }` | Message edited |
| `message_deleted` | `{ message_id, group_id }` | Message deleted |
| `ai_response` | `{ message, group_id }` | AI response |
| `typing` | `{ group_id, user_id, is_typing }` | Typing indicator |
| `user_joined` | `{ group_id, user_id }` | User joined group |
| `user_left` | `{ group_id, user_id }` | User left group |
| `user_online` | `{ user_id, group_id }` | User came online |
| `user_offline` | `{ user_id, group_id }` | User went offline |
| `reaction_added` | `{ message_id, emoji, user_id }` | Reaction added |
| `reaction_removed` | `{ message_id, emoji, user_id }` | Reaction removed |
| `messages_read` | `{ group_id, user_id, message_ids }` | Read receipt |

---

## Database Schema

### Collections

#### `groups`
```javascript
{
    _id: ObjectId,
    name: String (required),
    description: String,
    avatar_url: String,
    created_by: ObjectId (user),
    is_ai_enabled: Boolean,
    ai_auto_respond: Boolean,
    created_at: Date,
    updated_at: Date
}
```

#### `group_members`
```javascript
{
    group_id: ObjectId,
    user_id: ObjectId,
    role: String (admin/moderator/member),
    joined_at: Date
}
```

#### `messages`
```javascript
{
    _id: ObjectId,
    group_id: ObjectId,
    sender_id: ObjectId,
    sender_name: String,
    sender_avatar: String,
    content: String,
    message_type: String (text/image/file/voice/ai_response),
    reply_to_id: ObjectId,
    is_edited: Boolean,
    edited_at: Date,
    metadata: Object,
    status: [{
        user_id: ObjectId,
        status: String (sent/delivered/seen),
        seen_at: Date
    }],
    created_at: Date
}
```

#### `message_reactions`
```javascript
{
    message_id: ObjectId,
    user_id: ObjectId,
    emoji: String,
    created_at: Date
}
```

#### `ai_context`
```javascript
{
    group_id: ObjectId,
    context_window: [{
        role: String (user/assistant),
        content: String,
        timestamp: String
    }],
    last_updated: Date
}
```

---

## Permission Matrix

| Action | Admin | Moderator | Member |
|--------|-------|-----------|--------|
| Send messages | ✅ | ✅ | ✅ |
| Edit own messages | ✅ | ✅ | ✅ |
| Delete own messages | ✅ | ✅ | ✅ |
| Delete any message | ✅ | ✅ | ❌ |
| Add members | ✅ | ✅ | ❌ |
| Remove members | ✅ | ✅ | ❌ |
| Change roles | ✅ | ❌ | ❌ |
| Delete group | ✅ | ❌ | ❌ |
| Configure AI | ✅ | ❌ | ❌ |
| Pin messages | ✅ | ✅ | ❌ |

---

## AI Behavior

### Response Triggers

The AI responds when:

1. **Explicitly tagged**: `@AI`, `@Assistant`, `@Bot`
2. **Reply to AI message**: User replies to an AI message
3. **Auto-respond mode**: Group has `ai_auto_respond: true` and message is a question

### Context Management

- AI maintains a sliding window of **20 recent messages**
- Context is updated on every message
- Old messages are automatically pruned

### Example Interactions

```
User: @AI can you summarize what we discussed?
AI: Here's a summary of the conversation:
    • Frontend is 70% complete
    • Backend APIs are done
    • Testing needs to start Monday
```

```
User: What's the deadline for submission?
AI (in auto-mode): The deadline for the project submission is April 15th, 2026.
```

---

## Usage Examples

### Frontend Integration (React)

```javascript
// hooks/useGroupChat.js
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export function useGroupChat(groupId, token) {
    const [messages, setMessages] = useState([]);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // Connect to WebSocket
        const newSocket = io('http://localhost:10000', {
            auth: { token }
        });

        newSocket.on('connect', () => {
            newSocket.emit('join_group', { group_id: groupId });
        });

        newSocket.on('message_created', ({ message }) => {
            setMessages(prev => [...prev, message]);
        });

        newSocket.on('ai_response', ({ message }) => {
            setMessages(prev => [...prev, message]);
        });

        setSocket(newSocket);

        return () => {
            newSocket.emit('leave_group', { group_id: groupId });
            newSocket.close();
        };
    }, [groupId, token]);

    const sendMessage = (content) => {
        socket.emit('send_message', {
            group_id: groupId,
            content,
            type: 'text'
        });
    };

    const startTyping = () => {
        socket.emit('typing_start', { group_id: groupId });
    };

    const stopTyping = () => {
        socket.emit('typing_stop', { group_id: groupId });
    };

    return { messages, sendMessage, startTyping, stopTyping };
}
```

### Creating a Group

```javascript
// API call
const createGroup = async (name, description, memberIds) => {
    const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            name,
            description,
            member_ids: memberIds,
            is_ai_enabled: true
        })
    });
    return response.json();
};
```

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_MEMBER` | 403 | User is not a group member |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role |
| `GROUP_NOT_FOUND` | 404 | Group does not exist |
| `MESSAGE_NOT_FOUND` | 404 | Message does not exist |
| `INVALID_REQUEST` | 400 | Request validation failed |
| `REACTION_EXISTS` | 400 | Reaction already added |

### Error Response Format

```json
{
    "detail": "Error message here",
    "error_code": "NOT_MEMBER"
}
```

---

## Performance Considerations

### Optimizations

1. **Message Pagination**: Load messages in chunks (default: 50)
2. **Connection Pooling**: MongoDB uses 100 max connections
3. **Indexing**: Indexed on `group_id`, `created_at`, `sender_id`
4. **Caching**: AI context cached in `ai_context` collection

### Scalability

- Supports up to **1000 members** per group
- **Redis** recommended for production WebSocket scaling
- **Message TTL** can be configured for auto-archival

---

## Security

### Input Validation

- All inputs validated with Pydantic schemas
- Message content sanitized before storage
- File uploads scanned for malware (future)

### Rate Limiting

- Recommended: 100 messages/minute per user
- AI responses: 3/minute per group

### Data Protection

- JWT required for all operations
- Role-based access control enforced
- Cascade delete on group removal

---

## Testing

### Run Tests

```bash
# Run all group chat tests
pytest tests/test_groups.py -v

# Run single test
pytest tests/test_groups.py::TestGroupService::test_create_group -v
```

### Test Coverage

- Group CRUD operations
- Member management
- Message operations
- AI service logic
- Permission checks

---

## Deployment

### Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=miety_ai

# JWT
JWT_SECRET=your-secret-key

# AI (existing)
HUGGINGFACEHUB_API_TOKEN=...
OPENAI_API_KEY=...
```

### Docker

The group chat system is included in the main Docker image:

```bash
docker build -t student-assistant .
docker run -p 10000:10000 -e MONGODB_URI=... student-assistant
```

---

## Future Enhancements

1. **Threaded Conversations**: Nested replies like Slack
2. **Voice Messages**: Audio recording and playback
3. **File Previews**: Generate thumbnails for attachments
4. **Video Calls**: WebRTC integration
5. **Broadcast Channels**: One-to-many announcement mode
6. **Custom Emojis**: User-uploaded reaction emojis
7. **Message Scheduling**: Send messages at specific times
8. **Analytics**: Group activity dashboards

---

## Support

For issues or questions:
- Check existing tests in `tests/test_groups.py`
- Review API documentation at `/docs` (Swagger UI)
- Inspect MongoDB collections for debugging
