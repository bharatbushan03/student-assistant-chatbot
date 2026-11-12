# MIETY AI

Campus assistant for MIET Jammu. Students ask about admissions, courses, fees, placements, and campus life. Faculty and admins manage academic records and review each student’s dashboard.

Answers come from a Pinecone knowledge base plus NVIDIA Nemotron (`nvidia/nemotron-3-super-120b-a12b` on the [NVIDIA NIM API](https://build.nvidia.com/)). Accounts, chats, groups, and records are stored in MongoDB.

## What you can do

- Chat with retrieval over the MIET knowledge base, with a web fallback when the index has no match.
- Open a student dashboard for SGPA, CGPA, attendance, tasks, and campus notices.
- Review every student from the admin oversight page, publish notices, and create faculty or admin accounts.
- Use project workspaces with file context and streaming replies.
- Use group chat with live messaging and AI participation.

## Requirements

- Python 3.11
- Node.js 20
- MongoDB Atlas. The API rejects a local MongoDB URI.
- `NVIDIA_API_KEY` from [build.nvidia.com/settings](https://build.nvidia.com/settings)
- `PINECONE_API_KEY` from [app.pinecone.io](https://app.pinecone.io/)

## Run locally

From the repository root on Windows:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

On macOS or Linux, activate with `source venv/bin/activate` and copy the example file with `cp .env.example .env`.

Edit `.env` before starting the API:

| Variable | Purpose |
| --- | --- |
| `NVIDIA_API_KEY` | Nemotron chat |
| `PINECONE_API_KEY` | Vector search |
| `MONGODB_URI` | Users, messages, projects, and academic records |
| `JWT_SECRET` | Session signing. Replace the placeholder. |
| `BOOTSTRAP_ADMIN_EMAIL` | Optional first admin, shaped like `name.dept@mietjammu.in` |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password for that admin. Used only when no admin exists yet. |

Build the Pinecone index once, then start the API and the frontend in two terminals:

```powershell
python run.py
python -m uvicorn app.main:app --reload --port 10000
```

```powershell
cd frontend
npm install
npm run dev
```

The API is at [http://localhost:10000](http://localhost:10000). API docs are at [http://localhost:10000/docs](http://localhost:10000/docs). The app is at [http://localhost:5173](http://localhost:5173). Vite proxies `/auth`, `/chat`, `/api`, and `/socket.io` to port 10000, so leave `VITE_API_URL` empty.

`python run.py` scrapes MIET pages, chunks them, and embeds them into the Pinecone index named `miet-jammu-index` unless `PINECONE_INDEX_NAME` is set.

## Accounts

| Role | Email | How the account is created |
| --- | --- | --- |
| Student | `yourrollno@mietjammu.in` | Signup page. Lands on `/student/dashboard`. |
| Faculty | `yourname.dept@mietjammu.in` | Created by an admin. Marks editor is `/faculty/dashboard`. |
| Admin | `yourname.dept@mietjammu.in` | First admin can be created from `BOOTSTRAP_ADMIN_EMAIL`. Oversight is `/admin/dashboard`. |

Sign in with the matching mode on the login page. Faculty and admin accounts cannot self-register.

## Deploy

The React app is a static site on [Netlify](https://www.netlify.com/). The API is one container on [Northflank](https://northflank.com/), built from this repo’s `Dockerfile`. It listens on port 8080. MongoDB stays on Atlas, and embeddings go to the NVIDIA API.

Use Northflank’s free Sandbox and the `nf-compute-50` plan: 0.5 vCPU and 1 GB of RAM, about $12 of the $20 monthly allowance. That plan does not ask for a card. A second service or a larger plan can push the account past the allowance.

### Backend on Northflank

1. Push this repository to GitHub.
2. In Northflank, create a project, then a combined service. Choose this repo and the branch you want to run.
3. Build type: Dockerfile. Dockerfile path: `/Dockerfile`. Build context: `/`.
4. Northflank detects port 8080. Make that port public HTTP. The same port carries the API and Socket.IO.
5. Add a health check: HTTP `GET /health` on port 8080.
6. Set runtime variables from your local `.env`. Do not commit that file.

| Variable | Required |
| --- | --- |
| `NVIDIA_API_KEY` | Yes |
| `PINECONE_API_KEY` | Yes |
| `MONGODB_URI` | Yes. Atlas `mongodb+srv://` string |
| `MONGODB_DATABASE` | `miety_ai` |
| `JWT_SECRET` | Yes |
| `BOOTSTRAP_ADMIN_EMAIL` | Optional first admin |
| `BOOTSTRAP_ADMIN_PASSWORD` | Optional first admin |
| `CORS_ORIGINS` | `*` until you pin the Netlify URL |

7. Create the service and wait until the deployment is running. Open `https://<service>.northflank.app/health`.

In Atlas, allow connections from anywhere (`0.0.0.0/0`) unless you have another way to allow Northflank’s outbound addresses.

### Frontend on Netlify

1. Import this repository in Netlify. Leave the base directory empty. `netlify.toml` builds `frontend/` and publishes `frontend/dist`.
2. In Site configuration → Environment variables, set `VITE_API_URL` to the public HTTPS address Northflank shows for port 8080, with no trailing slash.
3. Deploy the site. Vite bakes `VITE_API_URL` into the bundle, so change that variable and then trigger a new deploy.

`CORS_ORIGINS=*` allows the Netlify site. To lock the API to one site, set `CORS_ORIGINS` to that exact origin, such as `https://your-site.netlify.app`, and keep `CORS_ALLOW_NETLIFY_PREVIEWS` as `true`. Local Vite keeps proxying to port 10000 when `VITE_API_URL` is empty.

## Tests

```powershell
pytest tests/ -q
cd frontend
npm test
```

## Layout

```
app/                     FastAPI routes, RAG, auth, groups, and dashboards
frontend/                React app, deployed on Netlify
ingestion/               Scrape, chunk, and embed into Pinecone
netlify.toml             Netlify build and SPA redirect
Dockerfile               API image for Northflank
docker-compose.yml       Local API container, using the Atlas URI from .env
```

Interactive route docs are served at `/docs` when the API is running.

## License

MIT
