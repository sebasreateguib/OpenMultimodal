"""LLM provider factory: Gemini (multimodal) and Groq (text-fast)."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Literal

from src.config import Settings, get_settings

logger = logging.getLogger(__name__)

ProviderId = Literal["gemini", "groq"]


@dataclass(frozen=True)
class ModelOption:
    provider: ProviderId
    model_id: str
    label: str
    multimodal: bool
    description: str


# Catalog shown in the UI / GET /models
MODEL_CATALOG: tuple[ModelOption, ...] = (
    ModelOption(
        provider="gemini",
        model_id="gemini-3.5-flash",
        label="Gemini 3.5 Flash",
        multimodal=True,
        description="Respuestas con texto + imágenes (VLM)",
    ),
    ModelOption(
        provider="gemini",
        model_id="gemini-3.1-flash-lite",
        label="Gemini 3.1 Flash-Lite",
        multimodal=True,
        description="Más barato/rápido, también multimodal",
    ),
    ModelOption(
        provider="groq",
        model_id="llama-3.3-70b-versatile",
        label="Llama 3.3 70B (Groq)",
        multimodal=False,
        description="Texto rápido vía Groq (sin visión nativa)",
    ),
    ModelOption(
        provider="groq",
        model_id="llama-3.1-8b-instant",
        label="Llama 3.1 8B Instant (Groq)",
        multimodal=False,
        description="Ultra rápido para demos de texto",
    ),
    ModelOption(
        provider="groq",
        model_id="openai/gpt-oss-120b",
        label="GPT-OSS 120B (Groq)",
        multimodal=False,
        description="Modelo grande hospedado en Groq (si tu cuenta lo tiene)",
    ),
)


def _ensure_google_api_key(settings: Settings) -> None:
    if not os.environ.get("GOOGLE_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = settings.gemini_api_key
    if not os.environ.get("GEMINI_API_KEY"):
        os.environ["GEMINI_API_KEY"] = settings.gemini_api_key


def available_models(settings: Settings | None = None) -> list[dict[str, Any]]:
    """Return catalog entries the user can actually call (keys present)."""
    settings = settings or get_settings()
    out: list[dict[str, Any]] = []
    for opt in MODEL_CATALOG:
        if opt.provider == "gemini" and not settings.gemini_api_key:
            continue
        if opt.provider == "groq" and not (settings.groq_api_key or "").strip():
            continue
        out.append(
            {
                "provider": opt.provider,
                "model_id": opt.model_id,
                "label": opt.label,
                "multimodal": opt.multimodal,
                "description": opt.description,
            }
        )
    return out


def resolve_model(
    *,
    provider: ProviderId | None = None,
    model_id: str | None = None,
    settings: Settings | None = None,
) -> ModelOption:
    """Pick a concrete model; fall back to settings defaults."""
    settings = settings or get_settings()
    provider = provider or settings.default_llm_provider  # type: ignore[assignment]
    if provider not in ("gemini", "groq"):
        provider = "gemini"

    if not model_id:
        model_id = (
            settings.groq_model if provider == "groq" else settings.gemini_model
        )
    model_id = model_id.removeprefix("models/")

    for opt in MODEL_CATALOG:
        if opt.provider == provider and opt.model_id == model_id:
            return opt

    # Unknown id — still allow (custom / newly released)
    return ModelOption(
        provider=provider,  # type: ignore[arg-type]
        model_id=model_id,
        label=model_id,
        multimodal=provider == "gemini",
        description="Custom model",
    )


def build_llm(
    *,
    provider: ProviderId | None = None,
    model_id: str | None = None,
    settings: Settings | None = None,
) -> tuple[Any, ModelOption]:
    """Instantiate the synthesis LLM for the chosen provider/model."""
    settings = settings or get_settings()
    choice = resolve_model(provider=provider, model_id=model_id, settings=settings)

    if choice.provider == "groq":
        key = (settings.groq_api_key or "").strip()
        if not key:
            raise ValueError(
                "GROQ_API_KEY no configurada. Añádela al .env para usar modelos Groq."
            )
        from llama_index.llms.groq import Groq

        llm = Groq(model=choice.model_id, api_key=key)
        return llm, choice

    _ensure_google_api_key(settings)
    try:
        from llama_index.llms.google_genai import GoogleGenAI

        llm = GoogleGenAI(model=choice.model_id, api_key=settings.gemini_api_key)
        return llm, choice
    except ImportError:
        pass

    try:
        from llama_index.multi_modal_llms.gemini import GeminiMultiModal

        llm = GeminiMultiModal(model_name=choice.model_id, api_key=settings.gemini_api_key)
        return llm, choice
    except ImportError:
        from llama_index.llms.gemini import Gemini

        llm = Gemini(model=choice.model_id, api_key=settings.gemini_api_key)
        return llm, choice
