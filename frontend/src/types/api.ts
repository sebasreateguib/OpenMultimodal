export interface SourceItem {
  score?: number | null
  file_path?: string | null
  source_page?: string | number | null
  text_preview?: string | null
}

export interface QueryRequest {
  query: string
  /** Basename of a document/image to scope retrieval (optional). */
  file_name?: string | null
}

export interface QueryResponse {
  answer: string
  text_sources: SourceItem[]
  image_sources: SourceItem[]
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

export interface HealthResponse {
  status: string
}
