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
    QueryRequest,
    QueryResponse,
    SourceItem,
)
from src.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_SUFFIXES = {".pdf", ".pptx", ".docx", ".png", ".jpg", ".jpeg", ".webp"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB per file


def _safe_filename(name: str) -> str:
    base = Path(name).name
    cleaned = re.sub(r"[^\w.\- ]+", "_", base).strip().replace(" ", "_")
    return cleaned or "upload.bin"


@router.post("/ingest", response_model=IngestResponse)
async def ingest_documents(request: IngestRequest) -> IngestResponse:
    """Parse documents with LlamaParse and index into Qdrant."""
    try:
        result = await ingest_documents_tool(path=request.path)
        return IngestResponse(**result)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Ingest failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


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
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents() -> DocumentListResponse:
    """List uploaded files available for scoped chat queries."""
    try:
        docs = list_indexed_documents()
        return DocumentListResponse(documents=[DocumentItem(**d) for d in docs])
    except Exception as exc:  # noqa: BLE001
        logger.exception("List documents failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/query", response_model=QueryResponse)
async def query_agent(request: QueryRequest) -> QueryResponse:
    """Retrieve Top-K text + Top-M images and synthesize with Gemini VLM."""
    try:
        result = await query_documents_tool(
            query=request.query,
            file_name=request.file_name,
        )
        return QueryResponse(
            answer=result.answer,
            text_sources=[SourceItem(**s) for s in result.text_sources],
            image_sources=[SourceItem(**s) for s in result.image_sources],
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Query failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
