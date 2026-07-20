export interface SourceItem {
  score?: number | null
  file_path?: string | null
  source_page?: string | number | null
  text_preview?: string | null
}

export type LlmProvider = 'gemini' | 'groq'

export interface QueryRequest {
  query: string
  /** Basename of a document/image to scope retrieval (optional). */
  file_name?: string | null
  provider?: LlmProvider | null
  model_id?: string | null
}

export interface QueryResponse {
  answer: string
  text_sources: SourceItem[]
  image_sources: SourceItem[]
  provider?: string | null
  model_id?: string | null
}

export interface IngestRequest {
  path?: string | null
}

export interface IngestResponse {
  status: string
  documents_indexed: number
  path?: string | null
  message?: string | null
}

export interface DocumentItem {
  file_name: string
  file_path: string
  size_bytes: number
  kind: 'document' | 'image'
}

export interface DocumentListResponse {
  documents: DocumentItem[]
}

export interface ModelItem {
  provider: LlmProvider
  model_id: string
  label: string
  multimodal: boolean
  description: string
}

export interface ModelListResponse {
  models: ModelItem[]
  default_provider: string
  default_model_id: string
}

export interface HealthResponse {
  status: string
}
