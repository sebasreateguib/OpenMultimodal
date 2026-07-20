"""LlamaParse setup and multimodal document extraction."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Sequence

from llama_index.core.schema import Document, ImageNode, TextNode
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import Settings, get_settings

logger = logging.getLogger(__name__)


class DocumentParseError(Exception):
    """Raised when a document cannot be parsed."""


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    reraise=True,
)
def _parse_with_llamaparse(file_path: Path, api_key: str) -> list[Document]:
    """Parse a single file via LlamaParse (sync, with backoff on rate limits)."""
    from llama_parse import LlamaParse

    # Multimodal / vision-friendly parse: markdown tables + page structure.
    # Extra LlamaParse flags vary by SDK version; keep core options stable.
    parser = LlamaParse(
        api_key=api_key,
        result_type="markdown",
        verbose=True,
    )
    return parser.load_data(str(file_path))


def _attach_provenance(
    nodes: Sequence[TextNode | ImageNode],
    *,
    file_path: Path,
) -> list[TextNode | ImageNode]:
    """Ensure every node keeps origin metadata (source_page, file_path, file_name)."""
    enriched: list[TextNode | ImageNode] = []
    resolved = str(file_path.resolve())
    for node in nodes:
        metadata = dict(node.metadata or {})
        metadata.setdefault("file_path", resolved)
        metadata.setdefault("file_name", file_path.name)
        if "source_page" not in metadata:
            page = metadata.get("page_label") or metadata.get("page") or metadata.get("page_number")
            if page is not None:
                metadata["source_page"] = page
        node.metadata = metadata
        enriched.append(node)
    return enriched


async def parse_document(
    file_path: Path | str,
    settings: Settings | None = None,
) -> list[Document]:
    """
    Ingest a PDF (or similar) with LlamaParse multimodal mode.

    Tables become Markdown/HTML; diagrams/figures should appear as image-aware
    content. Corrupted pages are logged and skipped when possible.
    """
    settings = settings or get_settings()
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Document not found: {path}")

    try:
        documents = await asyncio.to_thread(
            _parse_with_llamaparse,
            path,
            settings.llama_cloud_api_key,
        )
    except Exception as exc:  # noqa: BLE001 — surface parse failures cleanly
        logger.exception("Failed to parse %s", path)
        raise DocumentParseError(f"Failed to parse {path}: {exc}") from exc

    for doc in documents:
        doc.metadata = dict(doc.metadata or {})
        doc.metadata.setdefault("file_path", str(path.resolve()))
        doc.metadata.setdefault("file_name", path.name)
        if "source_page" not in doc.metadata:
            page = (
                doc.metadata.get("page_label")
                or doc.metadata.get("page")
                or doc.metadata.get("page_number")
            )
            if page is not None:
                doc.metadata["source_page"] = page

    logger.info("Parsed %s into %d document(s)", path.name, len(documents))
    return documents


async def parse_directory(
    directory: Path | str | None = None,
    settings: Settings | None = None,
) -> list[Document]:
    """Parse all supported files under raw_documents/."""
    settings = settings or get_settings()
    root = Path(directory) if directory else settings.raw_documents_dir
    if not root.exists():
        root.mkdir(parents=True, exist_ok=True)
        logger.warning("Created empty documents directory: %s", root)
        return []

    suffixes = {".pdf", ".pptx", ".docx", ".png", ".jpg", ".jpeg", ".webp"}
    files = sorted(p for p in root.rglob("*") if p.suffix.lower() in suffixes)
    all_docs: list[Document] = []
    for file_path in files:
        try:
            docs = await parse_document(file_path, settings=settings)
            all_docs.extend(docs)
        except DocumentParseError:
            logger.warning("Skipping corrupted or unreadable file: %s", file_path)
    return all_docs


def enrich_nodes_with_provenance(
    nodes: Sequence[TextNode | ImageNode],
    file_path: Path | str,
) -> list[TextNode | ImageNode]:
    """Public helper to attach file_path / source_page on ImageNode and TextNode."""
    return _attach_provenance(nodes, file_path=Path(file_path))
