# MIET Student Assistant Chatbot

A **RAG-powered chatbot** for MIET Jammu students. Ask about admissions, courses, fees, placements, campus life, and more.

Built with **FastAPI** + **Pinecone** + **HuggingFace Inference API** (default: Qwen/Qwen2.5-72B-Instruct).

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/bharatbushan03/student-assistant-chatbot.git
cd student-assistant-chatbot
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your HuggingFace API token and PINECONE_API_KEY
```

### 3. Build the knowledge base

```bash
python run.py
```

### 4. Start the server

```bash
python -m uvicorn app.main:app --reload
```

Open **http://localhost:8000** in your browser.

---

## Deploy to Render

1. Push to GitHub
2. Connect the repo on [Render](https://render.com)
3. Set `HUGGINGFACEHUB_API_TOKEN` in Environment tab
4. Deploy — Render uses the `Dockerfile` and `render.yaml` automatically

---

## Project Structure

```
├── app/
│   ├── main.py              # FastAPI entry-point
│   ├── config/settings.py   # Pydantic settings
│   ├── routes/chat.py       # /chat/ask endpoint
│   ├── services/
│   │   ├── rag_pipeline.py  # Retrieve → Prompt → Generate
│   │   ├── llm.py           # OpenAI / HuggingFace client
│   │   ├── retriever.py     # Pinecone vector search
│   │   └── embeddings.py    # Sentence-transformer loader
│   ├── models/              # Pydantic request schemas
│   └── utils/               # Text cleaning helpers
├── frontend/                # HTML/CSS/JS chat UI
├── ingestion/               # Web scraping & embedding pipeline
├── data/                    # Raw/processed chunks (vector store now lives in Pinecone)
├── Dockerfile               # Production container
├── render.yaml              # Render deployment blueprint
└── requirements.txt         # Python dependencies
```

---

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Chat frontend |
| `POST` | `/chat/ask` | Send a question, get an answer |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger API docs |

---

## License

MIT