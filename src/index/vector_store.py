"""Qdrant MultiModalVectorStore initialization."""

from __future__ import annotations

import logging
from typing import Sequence

import qdrant_client
from llama_index.core import StorageContext
from llama_index.core.indices import MultiModalVectorStoreIndex
from llama_index.core.schema import Document
from llama_index.vector_stores.qdrant import QdrantVectorStore

from src.config import Settings, STORAGE_DIR, get_settings
from src.ingestion.embedder import configure_embedding_models

logger = logging.getLogger(__name__)

TEXT_COLLECTION = "mm_text_collection"
IMAGE_COLLECTION = "mm_image_collection"


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


def build_storage_context(
    settings: Settings | None = None,
    *,
    client: qdrant_client.QdrantClient | None = None,
) -> StorageContext:
    """Initialize separated text/image Qdrant collections for multimodal indexing."""
    settings = settings or get_settings()
    client = client or create_qdrant_client(settings)

    text_store = QdrantVectorStore(client=client, collection_name=TEXT_COLLECTION)
    image_store = QdrantVectorStore(client=client, collection_name=IMAGE_COLLECTION)
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
    storage_context = build_storage_context(settings)
    return MultiModalVectorStoreIndex.from_vector_store(
        vector_store=storage_context.vector_store,
        image_vector_store=storage_context.image_store,
        embed_model=text_embedder,
        image_embed_model=image_embedder,
    )
