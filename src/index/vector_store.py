"""Qdrant MultiModalVectorStore initialization."""

from __future__ import annotations

import logging
from typing import Sequence

import qdrant_client
from llama_index.core import StorageContext
from llama_index.core.indices import MultiModalVectorStoreIndex
from llama_index.core.schema import Document
from llama_index.vector_stores.qdrant import QdrantVectorStore
from qdrant_client.http import models as rest

from src.config import Settings, STORAGE_DIR, get_settings
from src.ingestion.embedder import configure_embedding_models

logger = logging.getLogger(__name__)

TEXT_COLLECTION = "mm_text_collection"
IMAGE_COLLECTION = "mm_image_collection"
# gemini-embedding-2 default output size used by this project
DEFAULT_VECTOR_SIZE = 3072


def create_qdrant_client(settings: Settings | None = None) -> qdrant_client.QdrantClient:
    """Create a Qdrant client (remote URL or local on-disk storage)."""
    settings = settings or get_settings()
    storage = settings.storage_dir
    storage.mkdir(parents=True, exist_ok=True)

    if settings.qdrant_url.startswith("http"):
        return qdrant_client.QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
        )

    # Local path mode: store under data/storage/
    path = storage / "qdrant_db"
    path.mkdir(parents=True, exist_ok=True)
    return qdrant_client.QdrantClient(path=str(path))


def _infer_vector_size(client: qdrant_client.QdrantClient) -> int:
    """Prefer the existing text collection size; fall back to Gemini default."""
    try:
        if client.collection_exists(TEXT_COLLECTION):
            info = client.get_collection(TEXT_COLLECTION)
            vectors = info.config.params.vectors
            if hasattr(vectors, "size") and vectors.size:
                return int(vectors.size)
            if isinstance(vectors, dict) and vectors:
                first = next(iter(vectors.values()))
                if getattr(first, "size", None):
                    return int(first.size)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not infer vector size from text collection: %s", exc)
    return DEFAULT_VECTOR_SIZE


def ensure_collections(
    client: qdrant_client.QdrantClient,
    *,
    vector_size: int | None = None,
) -> None:
    """
    Ensure text + image collections exist.

    LlamaParse often yields only text nodes, so the image collection may never
    have been created during ingest — queries still expect it.
    """
    size = vector_size or _infer_vector_size(client)
    for name in (TEXT_COLLECTION, IMAGE_COLLECTION):
        if client.collection_exists(name):
            continue
        logger.info("Creating missing Qdrant collection %s (size=%d)", name, size)
        client.create_collection(
            collection_name=name,
            vectors_config=rest.VectorParams(size=size, distance=rest.Distance.COSINE),
        )


def build_vector_stores(
    settings: Settings | None = None,
    *,
    client: qdrant_client.QdrantClient | None = None,
) -> tuple[QdrantVectorStore, QdrantVectorStore]:
    """Create separated text/image Qdrant vector stores (collections guaranteed)."""
    settings = settings or get_settings()
    client = client or create_qdrant_client(settings)
    ensure_collections(client)
    text_store = QdrantVectorStore(client=client, collection_name=TEXT_COLLECTION)
    image_store = QdrantVectorStore(client=client, collection_name=IMAGE_COLLECTION)
    return text_store, image_store


def build_storage_context(
    settings: Settings | None = None,
    *,
    client: qdrant_client.QdrantClient | None = None,
) -> StorageContext:
    """Initialize separated text/image Qdrant collections for multimodal indexing."""
    text_store, image_store = build_vector_stores(settings, client=client)
    # Newer LlamaIndex stores the image store under vector_stores["image"]
    # (there is no StorageContext.image_store attribute).
    return StorageContext.from_defaults(vector_store=text_store, image_store=image_store)


def build_multimodal_index(
    documents: Sequence[Document],
    settings: Settings | None = None,
) -> MultiModalVectorStoreIndex:
    """
    Index TextNode / ImageNode content into MultiModalVectorStoreIndex on Qdrant.

    Uses dual embedding: gemini-embedding-2 for text; CLIP or Gemini captions for images.
    """
    settings = settings or get_settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    text_embedder, image_embedder = configure_embedding_models(settings)
    storage_context = build_storage_context(settings)

    logger.info("Building multimodal index from %d document(s)", len(documents))
    return MultiModalVectorStoreIndex.from_documents(
        list(documents),
        storage_context=storage_context,
        embed_model=text_embedder,
        image_embed_model=image_embedder,
    )


def load_multimodal_index(
    settings: Settings | None = None,
) -> MultiModalVectorStoreIndex:
    """Load an existing multimodal index from Qdrant collections."""
    settings = settings or get_settings()
    text_embedder, image_embedder = configure_embedding_models(settings)
    text_store, image_store = build_vector_stores(settings)
    return MultiModalVectorStoreIndex.from_vector_store(
        vector_store=text_store,
        image_vector_store=image_store,
        embed_model=text_embedder,
        image_embed_model=image_embedder,
    )
