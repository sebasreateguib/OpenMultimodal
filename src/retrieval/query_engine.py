"""MultiModal Query Engine & synthesis (Gemini VLM or Groq text)."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from llama_index.core.base.response.schema import Response
from llama_index.core.indices import MultiModalVectorStoreIndex
from llama_index.core.prompts import PromptTemplate
from llama_index.core.schema import ImageNode, MetadataMode, NodeWithScore, TextNode
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import Settings, get_settings
from src.llm import ProviderId, build_llm

logger = logging.getLogger(__name__)

QA_PROMPT = PromptTemplate(
    "You are a multimodal assistant. Answer using BOTH the text context and any "
    "diagrams/images provided. Cite visual evidence when relevant.\n\n"
    "Context:\n{context_str}\n\n"
    "Question: {query_str}\n\n"
    "Answer:"
)

QA_PROMPT_TEXT_ONLY = PromptTemplate(
    "You are a RAG assistant. Answer using ONLY the retrieved text context. "
    "If the context is insufficient, say so clearly.\n\n"
    "Context:\n{context_str}\n\n"
    "Question: {query_str}\n\n"
    "Answer:"
)


@dataclass
class QueryResult:
    """Structured query result for API / CLI consumers."""

    answer: str
    text_sources: list[dict[str, Any]] = field(default_factory=list)
    image_sources: list[dict[str, Any]] = field(default_factory=list)
    provider: str | None = None
    model_id: str | None = None


def _node_source_payload(node: NodeWithScore) -> dict[str, Any]:
    meta = dict(node.node.metadata or {})
    return {
        "score": float(node.score) if node.score is not None else None,
        "file_path": meta.get("file_path"),
        "source_page": meta.get("source_page"),
        "text_preview": (node.node.get_content(metadata_mode=MetadataMode.NONE) or "")[:240],
    }


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    reraise=True,
)
def _complete_with_backoff(llm: Any, prompt: str, image_documents: list[ImageNode]) -> str:
    """Call LLM with exponential backoff on rate limits.

    ``GeminiMultiModal.complete`` requires ``image_documents`` even when empty.
    Text-only LLMs (Groq, Gemini text) accept a plain prompt string.
    """
    import inspect

    images = list(image_documents)
    complete_fn = getattr(llm, "complete")
    try:
        params = inspect.signature(complete_fn).parameters
    except (TypeError, ValueError):
        params = {}

    if "image_documents" in params:
        try:
            return str(complete_fn(prompt=prompt, image_documents=images))
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Multimodal complete with %d image(s) failed (%s); retrying with [].",
                len(images),
                exc,
            )
            return str(complete_fn(prompt=prompt, image_documents=[]))

    return str(complete_fn(prompt))


def _node_matches_document(node: NodeWithScore, file_name: str) -> bool:
    """Match by file_name metadata or basename of file_path."""
    meta = dict(node.node.metadata or {})
    target = file_name.strip().lower()
    if not target:
        return True
    name = str(meta.get("file_name") or "").lower()
    if name and name == target:
        return True
    path = str(meta.get("file_path") or "")
    if path and Path(path).name.lower() == target:
        return True
    return False


class MultimodalQueryEngine:
    """Retrieves Top-K text + Top-M images and synthesizes with the chosen LLM."""

    def __init__(
        self,
        index: MultiModalVectorStoreIndex,
        settings: Settings | None = None,
        llm: Any | None = None,
        *,
        provider: ProviderId | None = None,
        model_id: str | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.index = index
        if llm is not None:
            self.llm = llm
            self.provider = provider or "gemini"
            self.model_id = model_id or self.settings.gemini_model
            self.multimodal = self.provider == "gemini"
        else:
            built, choice = build_llm(
                provider=provider,
                model_id=model_id,
                settings=self.settings,
            )
            self.llm = built
            self.provider = choice.provider
            self.model_id = choice.model_id
            self.multimodal = choice.multimodal

    def retrieve(
        self,
        query: str,
        *,
        file_name: str | None = None,
    ) -> list[NodeWithScore]:
        top_k = self.settings.similarity_top_k
        image_k = self.settings.image_similarity_top_k
        if file_name:
            top_k = max(top_k * 4, 20)
            image_k = max(image_k * 4, 12)

        retriever = self.index.as_retriever(
            similarity_top_k=top_k,
            image_similarity_top_k=image_k,
        )
        nodes = list(retriever.retrieve(query))

        if file_name:
            filtered = [n for n in nodes if _node_matches_document(n, file_name)]
            text = [n for n in filtered if isinstance(n.node, TextNode)][
                : self.settings.similarity_top_k
            ]
            images = [n for n in filtered if isinstance(n.node, ImageNode)][
                : self.settings.image_similarity_top_k
            ]
            nodes = text + images
            if not nodes:
                logger.warning("No nodes matched document filter: %s", file_name)

        return nodes

    def query(self, query: str, *, file_name: str | None = None) -> QueryResult:
        nodes = self.retrieve(query, file_name=file_name)
        image_nodes = [n for n in nodes if isinstance(n.node, ImageNode)]
        text_nodes = [n for n in nodes if isinstance(n.node, TextNode)]

        scope_note = f"(scoped to document: {file_name})\n\n" if file_name else ""
        context_str = "\n\n".join(
            n.get_content(metadata_mode=MetadataMode.LLM) for n in text_nodes
        ) or "(no text context retrieved for this document)"

        if self.multimodal:
            prompt = QA_PROMPT.format(
                context_str=f"{scope_note}{context_str}",
                query_str=query,
            )
            raw_images = [n.node for n in image_nodes]
        else:
            # Groq (and other text LLMs): fold image captions/paths into text context
            image_bits = []
            for n in image_nodes:
                meta = dict(n.node.metadata or {})
                preview = n.node.get_content(metadata_mode=MetadataMode.LLM) or ""
                image_bits.append(
                    f"[image {meta.get('file_name') or meta.get('file_path')}] {preview[:400]}"
                )
            extra = ("\n\nVisual refs:\n" + "\n".join(image_bits)) if image_bits else ""
            prompt = QA_PROMPT_TEXT_ONLY.format(
                context_str=f"{scope_note}{context_str}{extra}",
                query_str=query,
            )
            raw_images = []

        answer = _complete_with_backoff(self.llm, prompt, raw_images)

        return QueryResult(
            answer=answer,
            text_sources=[_node_source_payload(n) for n in text_nodes],
            image_sources=[_node_source_payload(n) for n in image_nodes],
            provider=self.provider,
            model_id=self.model_id,
        )

    async def aquery(
        self,
        query: str,
        *,
        file_name: str | None = None,
    ) -> QueryResult:
        import asyncio

        return await asyncio.to_thread(self.query, query, file_name=file_name)


def build_simple_query_engine(
    index: MultiModalVectorStoreIndex,
    settings: Settings | None = None,
) -> Any:
    settings = settings or get_settings()
    llm, _ = build_llm(settings=settings)
    return index.as_query_engine(
        llm=llm,
        similarity_top_k=settings.similarity_top_k,
        image_similarity_top_k=settings.image_similarity_top_k,
    )


def response_to_query_result(response: Response) -> QueryResult:
    nodes = list(response.source_nodes or [])
    return QueryResult(
        answer=str(response),
        text_sources=[
            _node_source_payload(n) for n in nodes if isinstance(n.node, TextNode)
        ],
        image_sources=[
            _node_source_payload(n) for n in nodes if isinstance(n.node, ImageNode)
        ],
    )
