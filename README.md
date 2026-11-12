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
- MongoDB, local or [Atlas](https://www.mongodb.com/atlas)
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

The React app is a static site on [Netlify](https://www.netlify.com/). The API is a Cloudflare Worker that forwards every request, including Socket.IO, to one [container](https://developers.cloudflare.com/containers/) built from this repo’s `Dockerfile`.

Netlify’s free plan can host the frontend. The API cannot run on the Workers Free plan. A Worker has a [10 ms CPU limit](https://developers.cloudflare.com/workers/platform/limits/) and cannot run FastAPI, MongoDB, Pinecone, or Socket.IO. [Containers are not on the free plan](https://developers.cloudflare.com/containers/platform/pricing/); they need Workers Paid ($5/month), which includes a monthly amount of container memory, CPU, and disk. This API uses the `standard-1` instance (4 GiB) so the embedding libraries fit, then sleeps after 15 minutes without requests.

### Backend on Cloudflare

You need Docker, a Cloudflare account on Workers Paid, and Wrangler 4.136 or newer.

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
npx wrangler secret put NVIDIA_API_KEY
npx wrangler secret put PINECONE_API_KEY
npx wrangler secret put MONGODB_URI
npx wrangler secret put JWT_SECRET
npx wrangler secret put BOOTSTRAP_ADMIN_PASSWORD
npm run deploy
```

`npm run deploy` publishes the API Worker only. The first image build is slow. After deploy, Wrangler prints a `*.workers.dev` URL. Wait until `npx wrangler containers list` shows the instance, then open `https://<worker>/health`.

MongoDB Atlas must accept connections from Cloudflare. Allowing `0.0.0.0/0` is the practical setting unless you restrict egress another way.

`.env` is only for local `uvicorn`. Cloudflare reads Worker secrets, which `cloudflare/src/index.js` passes into the container when it starts. Local `wrangler dev` reads `.dev.vars`, not `.env`.

### Frontend on Netlify

1. Import this repository in Netlify. Leave the base directory empty. `netlify.toml` builds `frontend/` and publishes `frontend/dist`.
2. In Site configuration → Environment variables, set `VITE_API_URL` to the Worker URL with no trailing slash, for example `https://miety-ai.<account>.workers.dev`.
3. Deploy the site. Vite bakes `VITE_API_URL` into the bundle, so change that variable and then trigger a new deploy.

Production, branch, and deploy-preview URLs on `*.netlify.app` are allowed when `CORS_ORIGINS` is `*`. To lock the API to one site, set the Worker variable `CORS_ORIGINS` to that exact origin, such as `https://your-site.netlify.app`, and keep `CORS_ALLOW_NETLIFY_PREVIEWS` as `true`. Local Vite keeps proxying to port 10000 when `VITE_API_URL` is empty.

## Tests

```powershell
pytest tests/ -q
cd frontend
npm test
```

## Layout

```
app/                     FastAPI routes, RAG, auth, groups, and dashboards
cloudflare/src/index.js  Worker: proxy to the API container
frontend/                React app, deployed on Netlify
ingestion/               Scrape, chunk, and embed into Pinecone
netlify.toml             Netlify build and SPA redirect
wrangler.jsonc           Worker and container settings
Dockerfile               API image
docker-compose.yml       Local API, frontend, and MongoDB
```

Interactive route docs are served at `/docs` when the API is running.

## License

MIT
