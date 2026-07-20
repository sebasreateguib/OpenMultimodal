# AGENT.md — Guidelines & Specification

**OpenMultimodal** | Multimodal RAG Agent | LlamaIndex + LlamaParse + Gemini + Qdrant

This file is the source of truth for AI coding assistants working in this repository. Prefer it over older PDFs when they conflict with the running code.

---

## 1. Project Overview

Build and maintain a **Multimodal Retrieval-Augmented Generation (RAG)** pipeline that:

1. Ingests PDFs, Office docs, diagrams, and images
2. Extracts text + visual context (LlamaParse)
3. Indexes dual embeddings into Qdrant (`MultiModalVectorStoreIndex`)
4. Answers user questions with Gemini, grounded on retrieved text/image nodes
5. Exposes FastAPI + a React UI with explicit modes (chat / images / documents)

---

## 2. Technical Stack

| Layer | Choice |
|-------|--------|
| Language | Python 3.11+ |
| API | FastAPI + `python-multipart` |
| Framework | LlamaIndex (core, multimodal index, Qdrant store) |
| Parsing | `llama-parse` (LlamaCloud) |
| Text embeddings | `gemini-embedding-2` via `llama-index-embeddings-google-genai` (preferred) |
| Image embeddings | CLIP if available; else **Gemini caption → text embedding** (`GeminiCaptionMultiModalEmbedding`) |
| LLM / VLM | `gemini-3.5-flash` (default; override with `GEMINI_MODEL`) |
| Vector DB | Qdrant (`mm_text_collection`, `mm_image_collection`) |
| Config | `pydantic-settings` in `src/config.py` |
| Frontend | React + Vite + Tailwind (`frontend/`) |

**Do not** hardcode retired models (`text-embedding-004`, `gemini-2.0-flash`, `gemini-2.5-flash` for new keys). Prefer `google.genai` / `llama-index-*-google-genai` over deprecated `google.generativeai`.

---

## 3. Repository Structure

```text
OpenMultimodal/
├── README.md                 # Human setup + end-to-end flow
├── AGENT.md                  # This file (agent directives)
├── MultimodalGuide.pdf       # Original architecture brief
├── pyproject.toml
├── .env.example
├── main.py                   # CLI (ingest / query / --serve)
├── data/
│   ├── raw_documents/        # Uploaded + local source files
│   └── storage/              # Qdrant volume / local storage
├── src/
│   ├── config.py             # Settings (lazy get_settings())
│   ├── main.py               # FastAPI app
│   ├── api/
│   │   ├── routes.py         # /ingest /upload /query /documents
│   │   └── schemas.py
│   ├── ingestion/
│   │   ├── parser.py         # LlamaParse + provenance metadata
│   │   └── embedder.py       # Text + MultiModalEmbedding
│   ├── index/
│   │   └── vector_store.py   # Qdrant MultiModalVectorStoreIndex
│   ├── retrieval/
│   │   └── query_engine.py   # Retrieve + Gemini synthesis + file filter
│   └── agent/
│       └── tools.py          # ingest / query / list_documents
└── frontend/
    └── src/components/
        └── ChatView.tsx      # Modes: chat | images | documents
```

---

## 4. End-to-End Workflow

### Boot

1. Qdrant on `QDRANT_URL` (default `http://localhost:6333`)
2. `.env` loaded via `get_settings()` — never instantiate Settings at import if keys may be missing without need
3. Backend: `python main.py --serve` → `:8000`
4. Frontend: `cd frontend && npm run dev` → `:5173` (proxies `/api`, `/health`)

### Ingestion

1. Files land in `data/raw_documents/` (UI upload or CLI/path ingest)
2. LlamaParse → markdown/tables; nodes get metadata:
   - `file_path` (absolute)
   - `file_name` (basename) — **required for scoped chat**
   - `source_page` when available
3. Embed text with `gemini-embedding-2`
4. Embed images with CLIP **or** GeminiCaption MultiModalEmbedding (must be a real `MultiModalEmbedding`, never a plain text embedder)
5. Persist to Qdrant multimodal collections

### Query

1. User asks in **Chatear** mode; optional `file_name` scopes retrieval
2. Over-fetch then filter by `file_name` / basename of `file_path` when scoped
3. Top-K text + Top-M images → Gemini prompt
4. `GeminiMultiModal.complete` **always** needs `image_documents` (pass `[]` if none)
5. Return answer + `text_sources` / `image_sources` for the Sources panel

### UI modes

| Mode | Behavior |
|------|----------|
| `chat` | Query only; document selector (all vs one `file_name`) |
| `images` | Accept PNG/JPG/WEBP → upload → ingest → switch to chat |
| `documents` | Accept PDF/PPTX/DOCX → upload → ingest → switch to chat |

---

## 5. HTTP API Contract

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | Liveness |
| `GET` | `/api/v1/documents` | List files under `raw_documents/` |
| `POST` | `/api/v1/upload` | `multipart/form-data` field `files` |
| `POST` | `/api/v1/ingest` | `{ "path": null \| string }` |
| `POST` | `/api/v1/query` | `{ "query": string, "file_name": string \| null }` |

---

## 6. Directives for AI Coding Assistants

1. **Type hints & async:** Annotate public functions. Use `async`/`await` (or `asyncio.to_thread`) for LlamaParse, Gemini, and upload I/O.
2. **Errors & backoff:** Keep `tenacity` (or equivalent) around external API calls. Surface clear HTTP 4xx/5xx messages to the UI.
3. **Provenance:** Never drop `file_path`, `file_name`, or `source_page` on text/image nodes.
4. **Secrets:** Only via `src/config.py` / env. Never commit `.env`.
5. **Multimodal embedding:** `image_embed_model` must be a `MultiModalEmbedding`. Do not fall back to a text-only embedder.
6. **Gemini complete:** If the LLM requires `image_documents`, always pass a list (empty allowed).
7. **Model IDs:** Default generation model `gemini-3.5-flash`; embeddings `gemini-embedding-2`. Normalize by stripping `models/` where needed; map retired embedding IDs to current ones.
8. **Scope:** Prefer minimal diffs. Match existing UI language (Spanish labels) and design tokens (`#4eebc8`, `#e8a838`, liquid-glass).
9. **Frontend:** Keep the three-mode UX; document selector only in chat mode. After successful ingest, return user to chat and refresh `/documents`.
10. **Docs:** When changing architecture or API, update **both** `README.md` and this `AGENT.md`.

---

## 7. Required Environment Variables

```env
GEMINI_API_KEY=...
LLAMA_CLOUD_API_KEY=...
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Optional
# GEMINI_MODEL=gemini-3.5-flash
# TEXT_EMBEDDING_MODEL=gemini-embedding-2
# SIMILARITY_TOP_K=5
# IMAGE_SIMILARITY_TOP_K=3
```

---

## 8. Quick Commands

```bash
# Backend
source .venv/bin/activate
pip install -e .
python main.py --serve

# Ingest / query CLI
python main.py ingest
python main.py --query "¿Qué ideas recomienda el documento?"

# Frontend
cd frontend && npm install && npm run dev

# Qdrant
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 \
  -v "$(pwd)/data/storage/qdrant_storage:/qdrant/storage" qdrant/qdrant
```

---

## 9. Known Pitfalls

- **429 / limit: 0** on Gemini → quota/billing or free-tier exhaustion; not an app bug.
- **404 model not found** → switch `GEMINI_MODEL` / embedding model; do not resurrect retired IDs.
- **AssertionError MultiModalEmbedding** → image embedder must subclass `MultiModalEmbedding`.
- **`missing image_documents`** → always pass the kwarg to `GeminiMultiModal.complete`.
- Changing embedding model → **re-ingest**; old Qdrant vectors are incompatible across embedding spaces.
