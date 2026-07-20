"""Environment & API key configuration via pydantic-settings."""

from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
RAW_DOCUMENTS_DIR = DATA_DIR / "raw_documents"
STORAGE_DIR = DATA_DIR / "storage"


class Settings(BaseSettings):
    """Application settings loaded from environment / .env."""

    gemini_api_key: str = Field(..., description="Google Gemini API key")
    llama_cloud_api_key: str = Field(..., description="LlamaCloud / LlamaParse API key")
    groq_api_key: Optional[str] = Field(
        default=None,
        description="Optional Groq API key for text LLMs",
    )
    qdrant_url: str = Field(default="http://localhost:6333")
    qdrant_api_key: Optional[str] = Field(default=None)

    text_embedding_model: str = Field(default="gemini-embedding-2")
    gemini_model: str = Field(default="gemini-3.5-flash")
    groq_model: str = Field(default="llama-3.3-70b-versatile")
    default_llm_provider: str = Field(default="gemini")  # gemini | groq
    similarity_top_k: int = Field(default=5)
    image_similarity_top_k: int = Field(default=3)

    raw_documents_dir: Path = Field(default=RAW_DOCUMENTS_DIR)
    storage_dir: Path = Field(default=STORAGE_DIR)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached settings. Raises ValidationError if required keys are missing."""
    return Settings()
