"""LlamaIndex Agent tools for ingest & query orchestration."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from src.config import Settings, get_settings
from src.index.vector_store import build_multimodal_index, load_multimodal_index
from src.ingestion.parser import parse_directory, parse_document
from src.retrieval.query_engine import MultimodalQueryEngine, QueryResult

logger = logging.getLogger(__name__)

_index_cache: Any | None = None
INDEXED_SUFFIXES = {".pdf", ".pptx", ".docx", ".png", ".jpg", ".jpeg", ".webp"}


def get_or_load_index(settings: Settings | None = None) -> Any:
    """Load cached multimodal index from Qdrant."""
    global _index_cache
    if _index_cache is None:
        settings = settings or get_settings()
        _index_cache = load_multimodal_index(settings)
    return _index_cache


def reset_index_cache() -> None:
    global _index_cache
    _index_cache = None


def list_indexed_documents(settings: Settings | None = None) -> list[dict[str, Any]]:
    """
    List files available under data/raw_documents/ (upload + ingest targets).

    Returns newest-first entries with file_name, path, size, and kind.
    """
    settings = settings or get_settings()
    root = settings.raw_documents_dir
    root.mkdir(parents=True, exist_ok=True)

    docs: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*"), key=lambda p: p.stat().st_mtime, reverse=True):
        if not path.is_file():
            continue
        if path.suffix.lower() not in INDEXED_SUFFIXES:
            continue
        suffix = path.suffix.lower()
        kind = "image" if suffix in {".png", ".jpg", ".jpeg", ".webp"} else "document"
        docs.append(
            {
                "file_name": path.name,
                "file_path": str(path.resolve()),
                "size_bytes": path.stat().st_size,
                "kind": kind,
            }
        )
    return docs


async def ingest_documents_tool(
    path: str | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """
    Agent tool: parse documents and rebuild the multimodal index.

    Args:
        path: Optional file or directory. Defaults to data/raw_documents/.
    """
    settings = settings or get_settings()
    target = Path(path) if path else settings.raw_documents_dir

    if target.is_file():
        documents = await parse_document(target, settings=settings)
    else:
        documents = await parse_directory(target, settings=settings)

    if not documents:
        return {"status": "empty", "documents_indexed": 0, "message": "No documents found."}

    index = build_multimodal_index(documents, settings=settings)
    global _index_cache
    _index_cache = index

    return {
        "status": "ok",
        "documents_indexed": len(documents),
        "path": str(target),
    }


async def query_documents_tool(
    query: str,
    settings: Settings | None = None,
    file_name: str | None = None,
    provider: str | None = None,
    model_id: str | None = None,
) -> QueryResult:
    """Retrieve Top-K text + Top-M images and synthesize with the chosen LLM."""
    settings = settings or get_settings()
    index = get_or_load_index(settings)
    from src.llm import ProviderId

    prov: ProviderId | None = None
    if provider in ("gemini", "groq"):
        prov = provider  # type: ignore[assignment]

    engine = MultimodalQueryEngine(
        index=index,
        settings=settings,
        provider=prov,
        model_id=model_id,
    )
    return await engine.aquery(query, file_name=file_name)


def build_agent_tool_specs() -> list[dict[str, str]]:
    """Describe available tools (for future FunctionAgent wiring)."""
    return [
        {
            "name": "ingest_documents",
            "description": "Parse PDFs/images with LlamaParse and index into Qdrant.",
        },
        {
            "name": "query_documents",
            "description": "Multimodal RAG query over indexed text and diagrams via Gemini VLM.",
        },
        {
            "name": "list_documents",
            "description": "List uploaded/indexed documents available for scoped chat.",
        },
    ]
