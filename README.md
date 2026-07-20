# OpenMultimodal

Agente **Multimodal RAG** (Retrieval-Augmented Generation) con **LlamaIndex**, **LlamaParse**, **Google Gemini** y **Qdrant**.

Subes PDFs, diagramas e imágenes → se indexan (texto + visuales) → preguntas en el chat y Gemini responde con evidencia de las fuentes recuperadas.

---

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Python 3.11+, FastAPI |
| Parsing | LlamaParse (LlamaCloud) |
| Embeddings | `gemini-embedding-2` |
| Imágenes (sin CLIP) | Captions con Gemini → embedding de texto |
| LLM / VLM | `gemini-3.5-flash` (configurable) |
| Vector DB | Qdrant |
| Frontend | React + Vite + Tailwind |

---

## Flujo completo (de inicio a fin)

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│ 1. Subir    │ ──▶ │ 2. Parsear   │ ──▶ │ 3. Embed &  │ ──▶ │ 4. Guardar│
│ PDF/imagen  │     │ LlamaParse   │     │ indexar     │     │ Qdrant   │
└─────────────┘     └──────────────┘     └─────────────┘     └────┬─────┘
                                                                  │
┌─────────────┐     ┌──────────────┐     ┌─────────────┐          │
│ 7. Respuesta│ ◀── │ 6. Gemini    │ ◀── │ 5. Retrieve │ ◀────────┘
│ + fuentes   │     │ sintetiza    │     │ Top-K/Top-M │  (pregunta)
└─────────────┘     └──────────────┘     └─────────────┘
```

### Arranque del sistema

1. **Qdrant** corre en `localhost:6333` (Docker).
2. Configuras `.env` con `GEMINI_API_KEY` y `LLAMA_CLOUD_API_KEY`.
3. Levantas el **backend** (`python main.py --serve` → `:8000`).
4. Levantas el **frontend** (`npm run dev` → `:5173`, proxy a la API).

### Ingestión (subir → indexar)

1. En la UI eliges modo **Documentos** o **Imágenes** (o pones archivos en `data/raw_documents/`).
2. El backend guarda el archivo y llama a **LlamaParse**:
   - texto y tablas → Markdown/HTML
   - cada chunk guarda `file_path`, `file_name`, `source_page`
3. **Embeddings**:
   - texto → `gemini-embedding-2`
   - imágenes → Gemini describe la figura y se embebe esa descripción (alternativa a CLIP)
4. Se indexa en Qdrant (`mm_text_collection` + `mm_image_collection`).

### Consulta (chatear → respuesta)

1. Modo **Chatear**: escribes la pregunta.
2. Opcional: selector **“Preguntar sobre”** → un archivo concreto, o todos.
3. La pregunta se embebe y Qdrant recupera los trozos más similares (Top‑K texto, Top‑M imágenes).
4. Si hay filtro de documento, solo se usan nodos de ese `file_name`.
5. Gemini recibe el contexto (+ imágenes si hay) y genera la respuesta.
6. La UI muestra la respuesta y el panel **Fuentes** (archivo, página, score).

### Fin del ciclo

Cada pregunta es independiente (no hay memoria de conversación larga en el backend).  
Para nuevos archivos: volver a **Documentos/Imágenes** → Indexar → Chatear otra vez.

---

## UI: tres modos

| Modo | Uso |
|------|-----|
| **Chatear** | Preguntas al índice. Selector de documento (todos o uno). |
| **Imágenes** | Sube PNG/JPG/WEBP, previsualiza lista, indexa. |
| **Documentos** | Sube PDF/PPTX/DOCX, indexa con LlamaParse. |

Tras indexar, la UI vuelve a **Chatear** automáticamente.

---

## Estructura del proyecto

```text
OpenMultimodal/
├── main.py                 # CLI + arranque uvicorn
├── pyproject.toml
├── .env.example
├── AGENT.md                # Directivas de arquitectura
├── data/
│   ├── raw_documents/      # PDFs e imágenes subidas
│   └── storage/            # Persistencia local (Qdrant volume)
├── src/
│   ├── config.py           # pydantic-settings
│   ├── main.py             # FastAPI app
│   ├── api/                # routes + schemas
│   ├── ingestion/          # parser.py, embedder.py
│   ├── index/              # vector_store.py (Qdrant multimodal)
│   ├── retrieval/          # query_engine.py
│   └── agent/              # tools (ingest, query, list docs)
└── frontend/               # React UI
```

---

## Setup

### 1. Backend

```bash
cd OpenMultimodal
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
```

Edita `.env`:

```env
GEMINI_API_KEY=...
LLAMA_CLOUD_API_KEY=...
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Opcional
# GEMINI_MODEL=gemini-3.5-flash
# TEXT_EMBEDDING_MODEL=gemini-embedding-2
```

### 2. Qdrant (local)

```bash
docker run -d --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v "$(pwd)/data/storage/qdrant_storage:/qdrant/storage" \
  qdrant/qdrant
```

Comprobar: http://localhost:6333/dashboard

### 3. Arrancar API

```bash
source .venv/bin/activate
python main.py --serve
```

- Health: http://localhost:8000/health  
- Docs: http://localhost:8000/docs  

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173 (Vite hace proxy de `/api` y `/health` al backend).

---

## API HTTP

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado del servicio |
| `GET` | `/api/v1/documents` | Lista archivos en `raw_documents/` |
| `POST` | `/api/v1/upload` | Multipart: sube archivos e indexa |
| `POST` | `/api/v1/ingest` | Indexa una ruta del servidor `{ "path": null }` |
| `POST` | `/api/v1/query` | Consulta RAG |

### Query (ejemplo)

```json
{
  "query": "¿Qué ideas recomienda el reto?",
  "file_name": "HACK_UTEC_Reto_Hackathon_Cloud.pdf"
}
```

`file_name` es opcional. Si es `null` o se omite, busca en todo el índice.

---

## CLI

```bash
# Indexar data/raw_documents/
python main.py ingest

# Consulta rápida
python main.py --query "¿Cuál es la arquitectura del sistema?"

# Subcomando
python main.py query -q "Resume las tablas principales"

# Servidor HTTP
python main.py --serve
```

---

## Variables de entorno

| Variable | Requerida | Default | Uso |
|----------|-----------|---------|-----|
| `GEMINI_API_KEY` | Sí | — | Embeddings + VLM + captions |
| `LLAMA_CLOUD_API_KEY` | Sí | — | LlamaParse |
| `QDRANT_URL` | No | `http://localhost:6333` | Vector DB |
| `QDRANT_API_KEY` | No | vacío | Qdrant Cloud |
| `GEMINI_MODEL` | No | `gemini-3.5-flash` | Modelo de generación |
| `TEXT_EMBEDDING_MODEL` | No | `gemini-embedding-2` | Embeddings |
| `SIMILARITY_TOP_K` | No | `5` | Textos recuperados |
| `IMAGE_SIMILARITY_TOP_K` | No | `3` | Imágenes recuperadas |

---

## Notas útiles

- **Cuota Gemini**: el free tier se agota rápido (sobre todo al captionar muchas imágenes). Si ves `429` o `limit: 0`, cambia de modelo, espera el reset o activa billing.
- **Modelos retirados**: no uses `text-embedding-004` ni `gemini-2.0-flash` / `gemini-2.5-flash` si tu cuenta es nueva; el proyecto ya apunta a `gemini-embedding-2` y `gemini-3.5-flash`.
- **CLIP** es opcional. Sin PyTorch/CLIP el sistema usa captions de Gemini.
- **Filtro por documento** funciona por `file_name` / basename de `file_path`. Tras cambiar el modelo de embeddings, vuelve a indexar.

---

## Referencias

- `AGENT.md` — especificación y directivas para agentes de código  
- `MultimodalGuide.pdf` — guía de arquitectura  
- `IA Multimodal Concepts and Applications.md` — conceptos del pipeline  
