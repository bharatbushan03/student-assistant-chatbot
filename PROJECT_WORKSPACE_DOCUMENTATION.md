# Project Workspace Module

This module adds a complete project-centric workspace where each project is an isolated container for chats, files, retrieval context, and settings.

## Feature Coverage

- Project management: create, rename, update metadata/settings, delete, share.
- Per-project chat system: create, rename, pin, delete chats; persistent messages per chat.
- File handling: upload, list, preview/download, delete, attach files to prompts.
- Context awareness:
  - Project file semantic retrieval via sentence-transformer embeddings.
  - Optional previous-chat context toggle at project level.
- Streaming responses: SSE endpoint streams assistant output tokens.
- Search and export:
  - Search messages across all chats in a project.
  - Export chat as Markdown or JSON.
- Reliability:
  - JWT-protected endpoints.
  - Request rate limiting for generation and uploads.
  - Activity logging per project action.

---

## Folder Structure

```text
app/
  models/
    project_workspace.py
  routes/
    projects.py
  schemas/
    project_workspace.py
  services/
    project_workspace_service.py

frontend/src/
  components/projects/
    ProjectChatPanel.jsx
    ProjectFilesPanel.jsx
    ProjectsSidebar.jsx
    ProjectTopbar.jsx
  utils/
    projectsApi.js
  ProjectsApp.jsx
```

---

## Data Model (MongoDB)

### `projects`

- `_id`: ObjectId
- `name`: string
- `description`: string
- `owner_id`: string
- `metadata`: object
- `settings`:
  - `include_project_files`: bool
  - `include_previous_chats`: bool
  - `model`: string
  - `temperature`: number
- `shared_user_ids`: string[]
- `created_at`: datetime
- `updated_at`: datetime

### `project_chats`

- `_id`: ObjectId
- `project_id`: string
- `owner_id`: string
- `title`: string
- `is_pinned`: bool
- `created_at`: datetime
- `updated_at`: datetime
- `last_message_at`: datetime

### `project_messages`

- `_id`: ObjectId
- `project_id`: string
- `chat_id`: string
- `user_id`: string
- `role`: `user | assistant`
- `content`: string
- `file_ids`: string[]
- `citations`: object[]
- `metadata`: object
- `created_at`: datetime

### `project_files`

- `_id`: ObjectId
- `project_id`: string
- `user_id`: string
- `filename`: string
- `stored_name`: string
- `storage_path`: string
- `content_type`: string
- `size_bytes`: number
- `preview_text`: string
- `extracted_text`: string
- `embedding`: number[]
- `created_at`: datetime
- `updated_at`: datetime

### `project_activity_logs`

- `_id`: ObjectId
- `project_id`: string
- `chat_id`: string | null
- `user_id`: string
- `action`: string
- `metadata`: object
- `created_at`: datetime

---

## Relationship Mapping

- User -> Projects: 1:N (`projects.owner_id`)
- Project -> Chats: 1:N (`project_chats.project_id`)
- Chat -> Messages: 1:N (`project_messages.chat_id`)
- Project -> Files: 1:N (`project_files.project_id`)

---

## API Endpoints

Base: `/api/projects`

### Projects

- `POST /` create project
- `GET /` list projects
- `GET /{project_id}` get project details
- `PATCH /{project_id}` update project
- `DELETE /{project_id}` delete project
- `POST /{project_id}/share` share project by email

### Chats

- `POST /{project_id}/chats` create chat
- `GET /{project_id}/chats` list chats
- `PATCH /{project_id}/chats/{chat_id}` rename/pin chat
- `DELETE /{project_id}/chats/{chat_id}` delete chat
- `GET /{project_id}/chats/{chat_id}/messages` list messages
- `POST /{project_id}/chats/{chat_id}/messages/stream` stream AI response (SSE)

### Files

- `GET /{project_id}/files` list files
- `POST /{project_id}/files` upload files
- `DELETE /{project_id}/files/{file_id}` delete file
- `GET /{project_id}/files/{file_id}/preview` preview/download file

### Search and Export

- `GET /{project_id}/search?q=...` search messages across project chats
- `GET /{project_id}/chats/{chat_id}/export?format=markdown|json|pdf` export chat

---

## Streaming Contract (SSE)

Response events from `POST /messages/stream`:

- `{"type":"start","user_message":{...}}`
- `{"type":"token","delta":"..."}`
- `{"type":"done","assistant_message":{...}}`

---

## Setup Instructions

1. Install backend dependencies:

```bash
pip install -r requirements.txt
```

2. Install frontend dependencies:

```bash
cd frontend
npm install
```

3. Start backend:

```bash
uvicorn app.main:app --reload
```

4. Start frontend dev server:

```bash
cd frontend
npm run dev
```

5. Open workspace:

- Navigate to `/projects` after login.

---

## Sample Environment Variables

Use existing `.env` values and add optional workspace tuning keys if desired:

```env
# Optional project workspace tuning
PROJECT_UPLOAD_MAX_MB=10
PROJECT_STREAM_RATE_LIMIT_PER_MIN=20
PROJECT_UPLOAD_RATE_LIMIT_PER_MIN=30
```

---

## Notes

- File embeddings are generated at upload-time and used for semantic retrieval.
- Uploaded files are stored locally at `data/project_uploads/{project_id}/`.
- Project actions are captured in `project_activity_logs` for observability.
