import { useEffect, useRef, useState } from 'react'
import { queryDocuments } from '../api/client'
import type { QueryResponse } from '../types/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface QueryChatProps {
  onResponse?: (response: QueryResponse) => void
}

const SUGGESTIONS = [
  '¿Cuál es la arquitectura del sistema mostrada en el diagrama?',
  'Resume las tablas principales del documento.',
  '¿Qué componentes aparecen en las figuras?',
]

export function QueryChat({ onResponse }: QueryChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function submitQuery(text: string) {
    const query = text.trim()
    if (!query || loading) return

    setError(null)
    setInput('')
    setLoading(true)

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
    }
    setMessages((prev) => [...prev, userMessage])

    try {
      const response = await queryDocuments({ query })
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.answer,
        },
      ])
      onResponse?.(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void submitQuery(input)
  }

  return (
    <section className="query-chat" aria-labelledby="query-heading">
      <header className="query-chat__header">
        <p className="panel__eyebrow">Consulta multimodal</p>
        <h2 id="query-heading">Pregunta a tus documentos</h2>
        <p className="panel__description">
          Recupera fragmentos de texto e imágenes indexados y sintetiza con Gemini VLM.
        </p>
      </header>

      <div className="query-chat__thread" role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && !loading && (
          <div className="query-chat__empty">
            <p>Escribe una pregunta o elige un ejemplo:</p>
            <div className="suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => void submitQuery(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <article
            key={message.id}
            className={`message message--${message.role}`}
          >
            <span className="message__role">
              {message.role === 'user' ? 'Tú' : 'Agente RAG'}
            </span>
            <div className="message__body">{message.content}</div>
          </article>
        ))}

        {loading && (
          <article className="message message--assistant message--loading" aria-busy="true">
            <span className="message__role">Agente RAG</span>
            <div className="message__body">
              <span className="typing-indicator">
                <span />
                <span />
                <span />
              </span>
            </div>
          </article>
        )}

        <div ref={endRef} />
      </div>

      {error && (
        <p className="feedback feedback--error" role="alert">
          {error}
        </p>
      )}

      <form className="query-chat__composer" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="query-input">
          Pregunta
        </label>
        <textarea
          id="query-input"
          rows={3}
          placeholder="Ej: ¿Qué muestra el diagrama de arquitectura en la página 3?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submitQuery(input)
            }
          }}
          disabled={loading}
        />
        <button type="submit" className="btn btn--primary" disabled={loading || !input.trim()}>
          {loading ? 'Consultando…' : 'Enviar'}
        </button>
      </form>
    </section>
  )
}
