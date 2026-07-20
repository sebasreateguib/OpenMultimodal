import { useState } from 'react'
import { ingestDocuments } from '../api/client'
import type { IngestResponse } from '../types/api'

interface IngestPanelProps {
  onIngestComplete?: (result: IngestResponse) => void
}

export function IngestPanel({ onIngestComplete }: IngestPanelProps) {
  const [path, setPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IngestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleIngest() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await ingestDocuments({
        path: path.trim() || null,
      })
      setResult(response)
      onIngestComplete?.(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al indexar documentos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel ingest-panel" aria-labelledby="ingest-heading">
      <header className="panel__header">
        <p className="panel__eyebrow">Pipeline</p>
        <h2 id="ingest-heading">Indexar documentos</h2>
        <p className="panel__description">
          Parsea PDFs y diagramas con LlamaParse e indexa texto e imágenes en Qdrant.
        </p>
      </header>

      <label className="field" htmlFor="ingest-path">
        <span className="field__label">Ruta opcional</span>
        <input
          id="ingest-path"
          type="text"
          placeholder="data/raw_documents/"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          disabled={loading}
        />
        <span className="field__hint">Vacío = carpeta por defecto del backend</span>
      </label>

      <button
        type="button"
        className="btn btn--primary"
        onClick={handleIngest}
        disabled={loading}
      >
        {loading ? 'Indexando…' : 'Ejecutar ingest'}
      </button>

      {error && (
        <p className="feedback feedback--error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="feedback feedback--success" role="status">
          <strong>{result.status}</strong>
          <span>{result.documents_indexed} documento(s) indexados</span>
          {result.path && <span className="feedback__meta">{result.path}</span>}
          {result.message && <span className="feedback__meta">{result.message}</span>}
        </div>
      )}
    </section>
  )
}
