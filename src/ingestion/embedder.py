"""Dual-embedding pipelines for text and vision.

Uses Google GenAI text embeddings. For images, prefers CLIP when available;
otherwise captions each image with Gemini and embeds the caption so the
result is a real MultiModalEmbedding (required by MultiModalVectorStoreIndex).
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

from llama_index.core.base.embeddings.base import Embedding
from llama_index.core.bridge.pydantic import Field, PrivateAttr
from llama_index.core.embeddings.multi_modal_base import MultiModalEmbedding
from llama_index.core.schema import ImageType

from src.config import Settings, get_settings

logger = logging.getLogger(__name__)


def _ensure_google_api_key(settings: Settings) -> None:
    """Google GenAI clients typically read GOOGLE_API_KEY."""
    if not os.environ.get("GOOGLE_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = settings.gemini_api_key
    if not os.environ.get("GEMINI_API_KEY"):
        os.environ["GEMINI_API_KEY"] = settings.gemini_api_key


def _normalize_model_name(name: str) -> str:
    """Strip optional models/ prefix used by older Gemini clients."""
    return name.removeprefix("models/")


def build_text_embedder(settings: Settings | None = None) -> Any:
    """Build Google text embedder via the current google.genai SDK."""
    settings = settings or get_settings()
    _ensure_google_api_key(settings)
    model_name = _normalize_model_name(settings.text_embedding_model)

    # Retired IDs → current embedding model
    if model_name in {"text-embedding-004", "embedding-001", "embedding-gecko-001"}:
        logger.warning(
            "Embedding model %s is retired; using gemini-embedding-2 instead.",
            model_name,
        )
        model_name = "gemini-embedding-2"

    try:
        from llama_index.embeddings.google_genai import GoogleGenAIEmbedding

        return GoogleGenAIEmbedding(
            model_name=model_name,
            api_key=settings.gemini_api_key,
        )
    except ImportError:
        # Legacy fallback (emits google.generativeai deprecation warning)
        from llama_index.embeddings.gemini import GeminiEmbedding

        return GeminiEmbedding(
            model_name=f"models/{model_name}",
            api_key=settings.gemini_api_key,
        )


class GeminiCaptionMultiModalEmbedding(MultiModalEmbedding):
    """
    MultiModalEmbedding that embeds images by captioning them with Gemini,
    then running the same text embedding model used for documents.

    This avoids the hard CLIP/torch dependency while satisfying
    MultiModalVectorStoreIndex's isinstance(..., MultiModalEmbedding) check.
    """

    model_name: str = Field(default="gemini-caption-mm")
    vision_model: str = Field(default="gemini-3.5-flash")
    api_key: str = Field(default="")

    _text_embedder: Any = PrivateAttr()
    _genai_client: Any = PrivateAttr(default=None)

    def __init__(
        self,
        text_embedder: Any,
        *,
        api_key: str,
        vision_model: str = "gemini-3.5-flash",
        **kwargs: Any,
    ) -> None:
        super().__init__(
            model_name=getattr(text_embedder, "model_name", "gemini-caption-mm"),
            vision_model=vision_model,
            api_key=api_key,
            **kwargs,
        )
        self._text_embedder = text_embedder
        self._genai_client = None

    @classmethod
    def class_name(cls) -> str:
        return "GeminiCaptionMultiModalEmbedding"

    def _client(self) -> Any:
        if self._genai_client is None:
            try:
                from google import genai

                self._genai_client = ("genai", genai.Client(api_key=self.api_key))
            except ImportError:
                import google.generativeai as generativeai

                generativeai.configure(api_key=self.api_key)
                self._genai_client = ("generativeai", generativeai)
        return self._genai_client

    def _load_image_bytes(self, img_file_path: ImageType) -> tuple[bytes, str]:
        if hasattr(img_file_path, "read"):
            data = img_file_path.read()  # type: ignore[union-attr]
            if isinstance(data, str):
                data = data.encode("utf-8")
            return bytes(data), "image/png"

        path = Path(str(img_file_path))
        suffix = path.suffix.lower().lstrip(".") or "png"
        mime = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
            "gif": "image/gif",
        }.get(suffix, "image/png")
        return path.read_bytes(), mime

    def _caption_image(self, img_file_path: ImageType) -> str:
        prompt = (
            "Describe this image for retrieval: include diagram labels, "
            "architecture components, table headers, and key visual details. "
            "Be concise but specific."
        )
        kind, client = self._client()
        raw, mime = self._load_image_bytes(img_file_path)

        if kind == "genai":
            from google.genai import types

            response = client.models.generate_content(
                model=self.vision_model,
                contents=[
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_bytes(data=raw, mime_type=mime),
                            types.Part.from_text(text=prompt),
                        ],
                    )
                ],
            )
            text = (response.text or "").strip()
        else:
            import io

            from PIL import Image

            model_name = self.vision_model.removeprefix("models/")
            model = client.GenerativeModel(model_name)
            image = Image.open(io.BytesIO(raw))
            response = model.generate_content([prompt, image])
            text = (getattr(response, "text", None) or "").strip()

        return text or "untitled diagram"

    # --- text embedding passthrough ---

    def _get_query_embedding(self, query: str) -> Embedding:
        return self._text_embedder.get_query_embedding(query)

    def _get_text_embedding(self, text: str) -> Embedding:
        return self._text_embedder.get_text_embedding(text)

    def _get_text_embeddings(self, texts: list[str]) -> list[Embedding]:
        return self._text_embedder.get_text_embedding_batch(texts)

    async def _aget_query_embedding(self, query: str) -> Embedding:
        return await self._text_embedder.aget_query_embedding(query)

    async def _aget_text_embedding(self, text: str) -> Embedding:
        return await self._text_embedder.aget_text_embedding(text)

    async def _aget_text_embeddings(self, texts: list[str]) -> list[Embedding]:
        return await self._text_embedder.aget_text_embedding_batch(texts)

    # --- image embedding via caption ---

    def _get_image_embedding(self, img_file_path: ImageType) -> Embedding:
        caption = self._caption_image(img_file_path)
        return self._text_embedder.get_text_embedding(caption)

    async def _aget_image_embedding(self, img_file_path: ImageType) -> Embedding:
        caption = await asyncio.to_thread(self._caption_image, img_file_path)
        return await self._text_embedder.aget_text_embedding(caption)


def build_image_embedder(
    settings: Settings | None = None,
    text_embedder: Any | None = None,
) -> MultiModalEmbedding:
    """
    Build a MultiModalEmbedding for images.

    Tries CLIP first; falls back to Gemini caption→text embedding (no torch).
    """
    settings = settings or get_settings()
    _ensure_google_api_key(settings)

    try:
        from llama_index.embeddings.clip import ClipEmbedding

        embedder = ClipEmbedding()
        logger.info("Using CLIP for image embeddings")
        return embedder
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "CLIP unavailable (%s). Using Gemini caption multimodal embeddings.",
            exc,
        )

    text_embedder = text_embedder or build_text_embedder(settings)
    # Prefer a current flash model for captions; strip models/ prefix if present
    vision = settings.gemini_model.removeprefix("models/")
    if "embedding" in vision:
        vision = "gemini-3.5-flash"

    return GeminiCaptionMultiModalEmbedding(
        text_embedder=text_embedder,
        api_key=settings.gemini_api_key,
        vision_model=vision,
    )


def configure_embedding_models(
    settings: Settings | None = None,
) -> tuple[Any, MultiModalEmbedding]:
    """Return (text_embedder, image_embedder) for MultiModalVectorStoreIndex."""
    settings = settings or get_settings()
    text_embedder = build_text_embedder(settings)
    image_embedder = build_image_embedder(settings, text_embedder=text_embedder)
    return text_embedder, image_embedder
