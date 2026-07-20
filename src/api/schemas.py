"""API request/response schemas."""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User question (text or image-aware prompt)")
    file_name: Optional[str] = Field(
        default=None,
        description="Optional document/image basename to scope retrieval (e.g. report.pdf)",
    )
    provider: Optional[Literal["gemini", "groq"]] = Field(
        default=None,
        description="LLM provider for synthesis. Default from settings.",
    )
    model_id: Optional[str] = Field(
        default=None,
        description="Model id for the provider (e.g. gemini-3.5-flash, llama-3.3-70b-versatile)",
    )


class SourceItem(BaseModel):
    score: Optional[float] = None
    file_path: Optional[str] = None
    source_page: Optional[Any] = None
    text_preview: Optional[str] = None


class QueryResponse(BaseModel):
    answer: str
    text_sources: list[SourceItem] = Field(default_factory=list)
    image_sources: list[SourceItem] = Field(default_factory=list)
    provider: Optional[str] = None
    model_id: Optional[str] = None


class IngestRequest(BaseModel):
    path: Optional[str] = Field(
        default=None,
        description="Optional file or directory. Defaults to data/raw_documents/.",
    )


class IngestResponse(BaseModel):
    status: str
    documents_indexed: int
    path: Optional[str] = None
    message: Optional[str] = None


class DocumentItem(BaseModel):
    file_name: str
    file_path: str
    size_bytes: int
    kind: Literal["document", "image"]


class DocumentListResponse(BaseModel):
    documents: list[DocumentItem] = Field(default_factory=list)


class ModelItem(BaseModel):
    provider: Literal["gemini", "groq"]
    model_id: str
    label: str
    multimodal: bool
    description: str


class ModelListResponse(BaseModel):
    models: list[ModelItem] = Field(default_factory=list)
    default_provider: str
    default_model_id: str
