"""FastAPI route handlers for ingest, upload, and multimodal query."""

from __future__ import annotations

import logging
import re
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from src.agent.tools import ingest_documents_tool, list_indexed_documents, query_documents_tool
from src.api.schemas import (
    DocumentItem,
    DocumentListResponse,
    IngestRequest,
    IngestResponse,
    ModelItem,
    ModelListResponse,
    QueryRequest,
    QueryResponse,
    SourceItem,
)
from src.config import get_settings
from src.llm import available_models, resolve_model

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_SUFFIXES = {".pdf", ".pptx", ".docx", ".png", ".jpg", ".jpeg", ".webp"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB per file

_QDRANT_HINT = (
    "Qdrant no está disponible (connection refused). "
    "Abre Docker Desktop y ejecuta: docker start qdrant "
    "(o el docker run del README). Comprueba http://localhost:6333/dashboard"
)


def _safe_filename(name: str) -> str:
    base = Path(name).name
    cleaned = re.sub(r"[^\w.\- ]+", "_", base).strip().replace(" ", "_")
    return cleaned or "upload.bin"


def _http_error_from_exception(exc: Exception) -> HTTPException:
    """Map infra failures to clearer API errors."""
    text = str(exc).lower()
    name = type(exc).__name__.lower()
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    if (
        "connection refused" in text
        or "connecterror" in name
        or "responsehandlingexception" in name
        or ("qdrant" in text and "connect" in text)
    ):
        return HTTPException(status_code=503, detail=_QDRANT_HINT)
    return HTTPException(status_code=500, detail=str(exc))


@router.post("/ingest", response_model=IngestResponse)
async def ingest_documents(request: IngestRequest) -> IngestResponse:
    """Parse documents with LlamaParse and index into Qdrant."""
    try:
        result = await ingest_documents_tool(path=request.path)
        return IngestResponse(**result)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Ingest failed")
        raise _http_error_from_exception(exc) from exc


@router.post("/upload", response_model=IngestResponse)
async def upload_documents(
    files: list[UploadFile] = File(..., description="PDFs, images, or Office docs"),
) -> IngestResponse:
    """
    Accept browser uploads, save under data/raw_documents/, then run ingest.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    settings = get_settings()
    dest_dir = settings.raw_documents_dir
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved: list[str] = []
    for upload in files:
        filename = _safe_filename(upload.filename or "upload.bin")
        suffix = Path(filename).suffix.lower()
        if suffix not in ALLOWED_SUFFIXES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {suffix or '(none)'}. "
                f"Allowed: {', '.join(sorted(ALLOWED_SUFFIXES))}",
            )

        target = dest_dir / filename
        # Avoid overwrite collisions
        if target.exists():
            stem, ext = target.stem, target.suffix
            n = 1
            while target.exists():
                target = dest_dir / f"{stem}_{n}{ext}"
                n += 1

        try:
            data = await upload.read()
            if len(data) > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=400,
                    detail=f"{filename} exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
                )
            target.write_bytes(data)
            saved.append(str(target))
        finally:
            await upload.close()

    try:
        # Ingest the whole raw_documents folder so all uploads are indexed together
        result = await ingest_documents_tool(path=str(dest_dir))
        result["message"] = f"Uploaded {len(saved)} file(s): " + ", ".join(
            Path(p).name for p in saved
        )
        result["path"] = str(dest_dir)
        return IngestResponse(**result)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Upload ingest failed")
        raise _http_error_from_exception(exc) from exc


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents() -> DocumentListResponse:
    """List uploaded files available for scoped chat queries."""
    try:
        docs = list_indexed_documents()
        return DocumentListResponse(documents=[DocumentItem(**d) for d in docs])
    except Exception as exc:  # noqa: BLE001
        logger.exception("List documents failed")
        raise _http_error_from_exception(exc) from exc


@router.get("/models", response_model=ModelListResponse)
async def list_models() -> ModelListResponse:
    """List LLM providers/models available with the configured API keys."""
    settings = get_settings()
    models = available_models(settings)
    default = resolve_model(settings=settings)
    return ModelListResponse(
        models=[ModelItem(**m) for m in models],
        default_provider=default.provider,
        default_model_id=default.model_id,
    )


@router.post("/query", response_model=QueryResponse)
async def query_agent(request: QueryRequest) -> QueryResponse:
    """Retrieve Top-K text + Top-M images and synthesize with the chosen LLM."""
    try:
        result = await query_documents_tool(
            query=request.query,
            file_name=request.file_name,
            provider=request.provider,
            model_id=request.model_id,
        )
        return QueryResponse(
            answer=result.answer,
            text_sources=[SourceItem(**s) for s in result.text_sources],
            image_sources=[SourceItem(**s) for s in result.image_sources],
            provider=result.provider,
            model_id=result.model_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Query failed")
        raise _http_error_from_exception(exc) from exc
