import type {
  DocumentListResponse,
  HealthResponse,
  IngestRequest,
  IngestResponse,
  ModelListResponse,
  QueryRequest,
  QueryResponse,
} from '../types/api'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      // ignore parse errors
    }
    throw new Error(detail || `Request failed (${response.status})`)
  }

  return response.json() as Promise<T>
}

export function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

export function ingestDocuments(body: IngestRequest = {}): Promise<IngestResponse> {
  return request<IngestResponse>('/api/v1/ingest', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function uploadDocuments(files: File[]): Promise<IngestResponse> {
  const form = new FormData()
  for (const file of files) {
    form.append('files', file)
  }

  const response = await fetch(`${API_BASE}/api/v1/upload`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // ignore parse errors
    }
    throw new Error(detail || `Upload failed (${response.status})`)
  }

  return response.json() as Promise<IngestResponse>
}

export function queryDocuments(body: QueryRequest): Promise<QueryResponse> {
  return request<QueryResponse>('/api/v1/query', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listDocuments(): Promise<DocumentListResponse> {
  return request<DocumentListResponse>('/api/v1/documents')
}

export function listModels(): Promise<ModelListResponse> {
  return request<ModelListResponse>('/api/v1/models')
}
