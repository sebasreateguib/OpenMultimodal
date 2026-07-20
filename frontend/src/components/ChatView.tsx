import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowUp,
  FileSearch,
  FileText,
  ImageIcon,
  Loader2,
  MessageSquare,
  PanelRight,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { checkHealth, listDocuments, queryDocuments, uploadDocuments } from '../api/client'
import type { DocumentItem, QueryResponse } from '../types/api'
import { SourcePanel } from './SourcePanel'
import { MarkdownMessage } from './MarkdownMessage'

interface ChatViewProps {
  onBack: () => void
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type ApiStatus = 'checking' | 'online' | 'offline'
type WorkspaceMode = 'chat' | 'images' | 'documents'

const SUGGESTIONS = [
  '¿Cuál es la arquitectura del sistema mostrada en el diagrama?',
  'Resume las tablas principales del documento.',
  '¿Qué componentes aparecen en las figuras?',
  'Explica el flujo de ingestión multimodal.',
] as const

const MODES: {
  id: WorkspaceMode
  label: string
  short: string
  icon: typeof MessageSquare
  accent: string
  description: string
}[] = [
  {
    id: 'chat',
    label: 'Chatear',
    short: 'Chat',
    icon: MessageSquare,
    accent: '#4eebc8',
    description: 'Pregunta sobre lo ya indexado',
  },
  {
    id: 'images',
    label: 'Imágenes',
    short: 'Imágenes',
    icon: ImageIcon,
    accent: '#e8a838',
    description: 'Sube diagramas, capturas o figuras',
  },
  {
    id: 'documents',
    label: 'Documentos',
    short: 'Docs',
    icon: FileText,
    accent: '#7eb6ff',
    description: 'Sube PDF, PPTX o DOCX para indexar',
  },
]

const ACCEPT: Record<Exclude<WorkspaceMode, 'chat'>, string> = {
  images: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp',
  documents:
    '.pdf,.pptx,.docx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function isAllowedForMode(file: File, mode: Exclude<WorkspaceMode, 'chat'>): boolean {
  const name = file.name.toLowerCase()
  if (mode === 'images') {
    return (
      file.type.startsWith('image/') ||
      ['.png', '.jpg', '.jpeg', '.webp'].some((ext) => name.endsWith(ext))
    )
  }
  return (
    ['.pdf', '.pptx', '.docx'].some((ext) => name.endsWith(ext)) ||
    file.type === 'application/pdf'
  )
}

export function ChatView({ onBack }: ChatViewProps) {
  const [mode, setMode] = useState<WorkspaceMode>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latest, setLatest] = useState<QueryResponse | null>(null)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selectedDoc, setSelectedDoc] = useState<string>('') // '' = all

  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const modeTabId = useId()

  const refreshHealth = useCallback(async () => {
    try {
      await checkHealth()
      setApiStatus('online')
    } catch {
      setApiStatus('offline')
    }
  }, [])

  const refreshDocuments = useCallback(async () => {
    try {
      const res = await listDocuments()
      setDocuments(res.documents)
      setSelectedDoc((current) => {
        if (!current) return ''
        return res.documents.some((d) => d.file_name === current) ? current : ''
      })
    } catch {
      // Keep previous list if API briefly unavailable
    }
  }, [])

  useEffect(() => {
    void refreshHealth()
    void refreshDocuments()
    const id = window.setInterval(() => {
      void refreshHealth()
      void refreshDocuments()
    }, 30000)
    return () => window.clearInterval(id)
  }, [refreshHealth, refreshDocuments])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, uploading])

  useEffect(() => {
    if (!uploadNote) return
    const id = window.setTimeout(() => setUploadNote(null), 4000)
    return () => window.clearTimeout(id)
  }, [uploadNote])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input, mode])

  useEffect(() => {
    setPendingFiles([])
    setError(null)
    setUploadNote(null)
    setDragOver(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [mode])

  async function submitQuery(text: string) {
    const query = text.trim()
    if (!query || loading || uploading) return

    setError(null)
    setUploadNote(null)
    setInput('')
    setLoading(true)
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: query },
    ])

    try {
      const response = await queryDocuments({
        query,
        file_name: selectedDoc || null,
      })
      setLatest(response)
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: response.answer },
      ])
      if (window.matchMedia('(max-width: 1023px)').matches) {
        setSourcesOpen(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la consulta')
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'chat') {
      void submitQuery(input)
      return
    }
    void confirmUpload()
  }

  function addPendingFiles(fileList: FileList | File[] | null) {
    if (!fileList || mode === 'chat') return
    const incoming = Array.from(fileList)
    const valid = incoming.filter((f) => isAllowedForMode(f, mode))
    const rejected = incoming.length - valid.length

    if (rejected > 0) {
      setError(
        mode === 'images'
          ? 'Solo se aceptan imágenes PNG, JPG o WEBP.'
          : 'Solo se aceptan PDF, PPTX o DOCX.',
      )
    } else {
      setError(null)
    }

    if (valid.length) {
      setPendingFiles((prev) => {
        const names = new Set(prev.map((f) => `${f.name}:${f.size}`))
        const next = valid.filter((f) => !names.has(`${f.name}:${f.size}`))
        return [...prev, ...next]
      })
      setUploadNote(null)
    }
  }

  async function confirmUpload() {
    if (mode === 'chat' || !pendingFiles.length || uploading || loading) return

    setUploading(true)
    setError(null)
    setUploadNote(null)

    const files = [...pendingFiles]
    const label = mode === 'images' ? 'imagen(es)' : 'documento(s)'

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: `Subí ${files.length} ${label}: ${files.map((f) => f.name).join(', ')}`,
      },
    ])

    try {
      const result = await uploadDocuments(files)
      const names = files.map((f) => f.name).join(', ')
      setUploadNote(
        result.message ??
          `${result.documents_indexed} archivo(s) indexados · ${names}`,
      )
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `${mode === 'images' ? 'Imágenes' : 'Documentos'} indexados (${result.documents_indexed}): ${names}. Cambia a Chatear para preguntar sobre ellos.`,
        },
      ])
      setPendingFiles([])
      setMode('chat')
      void refreshDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron subir los archivos')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (mode === 'chat' || busy) return
    addPendingFiles(e.dataTransfer.files)
  }

  const sourceCount =
    (latest?.text_sources.length ?? 0) + (latest?.image_sources.length ?? 0)
  const busy = loading || uploading
  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0]
  const showEmpty = messages.length === 0 && !loading && !uploading

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#050608] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(78,235,200,0.08),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(232,168,56,0.06),_transparent_40%)]"
        aria-hidden
      />

      <header className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6 md:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-2.5 text-xs text-white transition-colors duration-200 hover:border-white/30 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
            aria-label="Volver al inicio"
          >
            <ArrowLeft size={14} aria-hidden />
            <span className="hidden sm:inline">Inicio</span>
          </button>

          <div className="min-w-0">
            <p className="truncate font-[family-name:var(--font-display)] text-base font-semibold tracking-tight sm:text-lg">
              OpenMultimodal
            </p>
            <p className="truncate font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-white/40">
              {activeMode.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70"
            role="status"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                apiStatus === 'online'
                  ? 'bg-[#4eebc8] shadow-[0_0_10px_rgba(78,235,200,0.8)]'
                  : apiStatus === 'offline'
                    ? 'bg-red-400'
                    : 'animate-pulse bg-white/40'
              }`}
              aria-hidden
            />
            <span className="hidden sm:inline">
              {apiStatus === 'online'
                ? 'API en línea'
                : apiStatus === 'offline'
                  ? 'API offline'
                  : 'Conectando…'}
            </span>
          </span>

          <button
            type="button"
            onClick={() => setSourcesOpen(true)}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 text-sm transition-colors duration-200 hover:border-[#4eebc8]/40 hover:text-[#4eebc8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8] lg:hidden"
            aria-label="Ver fuentes recuperadas"
          >
            <PanelRight size={18} aria-hidden />
            <span className="font-[family-name:var(--font-mono)] text-[11px]">{sourceCount}</span>
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-7xl flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversación"
          >
            {showEmpty ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col justify-center">
                <div className="mb-8">
                  <p
                    className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: activeMode.accent }}
                  >
                    Modo {activeMode.label}
                  </p>
                  <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl">
                    {mode === 'chat' && (
                      <>
                        Pregunta a tus{' '}
                        <span className="font-serif italic font-normal text-[#e8a838]">
                          documentos
                        </span>
                        <span className="text-[#4eebc8]">.</span>
                      </>
                    )}
                    {mode === 'images' && (
                      <>
                        Sube{' '}
                        <span className="font-serif italic font-normal text-[#e8a838]">
                          imágenes
                        </span>{' '}
                        al índice.
                      </>
                    )}
                    {mode === 'documents' && (
                      <>
                        Indexa{' '}
                        <span className="font-serif italic font-normal text-[#e8a838]">
                          documentos
                        </span>
                        .
                      </>
                    )}
                  </h1>
                  <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/55">
                    {activeMode.description}. Cambia de modo arriba del compositor
                    cuando quieras.
                  </p>
                </div>

                {mode === 'chat' ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void submitQuery(suggestion)}
                        disabled={busy}
                        className="liquid-glass group cursor-pointer rounded-2xl p-4 text-left transition-transform duration-200 hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FileSearch
                          size={16}
                          className="mb-2 text-[#4eebc8] transition-colors group-hover:text-[#e8a838]"
                          aria-hidden
                        />
                        <span className="text-[13px] leading-snug text-white/75">
                          {suggestion}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy || apiStatus === 'offline'}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    className={`liquid-glass flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8] disabled:cursor-not-allowed disabled:opacity-50 ${
                      dragOver
                        ? 'border-[#4eebc8]/60 bg-[#4eebc8]/10'
                        : 'border-white/20 hover:border-white/35'
                    }`}
                  >
                    <Upload size={28} style={{ color: activeMode.accent }} aria-hidden />
                    <span className="font-[family-name:var(--font-display)] text-lg font-semibold">
                      Arrastra o elige {mode === 'images' ? 'imágenes' : 'documentos'}
                    </span>
                    <span className="max-w-sm text-[13px] text-white/45">
                      {mode === 'images'
                        ? 'PNG, JPG o WEBP · se indexan para búsqueda visual'
                        : 'PDF, PPTX o DOCX · LlamaParse + Qdrant'}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-5">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`flex max-w-[92%] flex-col gap-1.5 sm:max-w-[85%] ${
                      message.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-white/35">
                      {message.role === 'user' ? 'Tú' : 'Agente RAG'}
                    </span>
                    <div
                      className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed sm:text-[15px] ${
                        message.role === 'user'
                          ? 'rounded-br-md bg-[#4eebc8]/15 text-white'
                          : 'liquid-glass rounded-bl-md text-white/90'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <MarkdownMessage content={message.content} />
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </article>
                ))}

                {(loading || uploading) && (
                  <article
                    className="flex max-w-[85%] flex-col gap-1.5 self-start"
                    aria-busy="true"
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-white/35">
                      Agente RAG
                    </span>
                    <div className="liquid-glass flex items-center gap-3 rounded-2xl rounded-bl-md px-4 py-3">
                      <Loader2
                        size={16}
                        className="animate-spin text-[#4eebc8]"
                        aria-hidden
                      />
                      <span className="text-[14px] text-white/60">
                        {uploading
                          ? 'Subiendo e indexando archivos…'
                          : 'Recuperando fuentes y sintetizando…'}
                      </span>
                    </div>
                  </article>
                )}

                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-white/10 px-4 py-4 sm:px-6 md:px-8">
            <div className="mx-auto max-w-3xl">
              <div
                role="tablist"
                aria-label="Modo de trabajo"
                className="mb-3 flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
              >
                {MODES.map((item) => {
                  const Icon = item.icon
                  const selected = mode === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      id={`${modeTabId}-${item.id}`}
                      aria-selected={selected}
                      disabled={busy}
                      onClick={() => setMode(item.id)}
                      className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-[12px] font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8] disabled:cursor-not-allowed disabled:opacity-50 sm:text-[13px] ${
                        selected
                          ? 'bg-white text-[#050608]'
                          : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <Icon size={15} aria-hidden />
                      <span className="hidden sm:inline">{item.short}</span>
                    </button>
                  )
                })}
              </div>

              {error && (
                <p
                  id={errorId}
                  role="alert"
                  className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200"
                >
                  {error}
                </p>
              )}

              {uploadNote && mode === 'chat' && (
                <div
                  role="status"
                  className="mb-3 flex items-start gap-3 rounded-xl border border-[#4eebc8]/25 bg-[#4eebc8]/10 px-4 py-3 text-[13px] text-[#4eebc8]"
                >
                  <p className="min-w-0 flex-1 leading-relaxed">{uploadNote}</p>
                  <button
                    type="button"
                    onClick={() => setUploadNote(null)}
                    className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#4eebc8]/80 transition-colors duration-200 hover:bg-[#4eebc8]/15 hover:text-[#4eebc8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
                    aria-label="Cerrar aviso de carga"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
              )}

              {mode === 'chat' ? (
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-2"
                >
                  <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-white/40">
                      Preguntar sobre
                    </span>
                    <select
                      value={selectedDoc}
                      onChange={(e) => setSelectedDoc(e.target.value)}
                      disabled={busy}
                      className="min-h-11 w-full cursor-pointer rounded-xl border border-white/15 bg-[#0a0c10] px-3 text-[13px] text-white/90 outline-none transition-colors hover:border-white/30 focus:border-[#4eebc8]/50 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Documento o imagen a consultar"
                    >
                      <option value="">Todos los archivos indexados</option>
                      {documents.map((doc) => (
                        <option key={doc.file_path} value={doc.file_name}>
                          {doc.kind === 'image' ? '🖼' : '📄'} {doc.file_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="liquid-glass flex items-end gap-2 rounded-2xl p-2 sm:gap-3 sm:p-2.5">
                    <label htmlFor="chat-input" className="sr-only">
                      Escribe tu pregunta multimodal
                    </label>
                    <textarea
                      id="chat-input"
                      ref={textareaRef}
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void submitQuery(input)
                        }
                      }}
                      disabled={busy}
                      aria-describedby={error ? errorId : undefined}
                      placeholder={
                        selectedDoc
                          ? `Pregunta sobre ${selectedDoc}…`
                          : 'Pregunta sobre diagramas, tablas o texto…'
                      }
                      className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 text-[15px] text-white placeholder:text-white/35 focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={busy || !input.trim()}
                      className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#4eebc8] text-[#050608] transition-all duration-200 hover:scale-105 hover:bg-[#6ff0d4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                      aria-label={loading ? 'Consultando' : 'Enviar pregunta'}
                    >
                      {loading ? (
                        <Loader2 size={18} className="animate-spin" aria-hidden />
                      ) : (
                        <ArrowUp size={18} strokeWidth={2.5} aria-hidden />
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  className={`liquid-glass rounded-2xl p-3 sm:p-4 ${
                    dragOver ? 'ring-1 ring-[#4eebc8]/50' : ''
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPT[mode]}
                    className="sr-only"
                    aria-label={
                      mode === 'images' ? 'Seleccionar imágenes' : 'Seleccionar documentos'
                    }
                    onChange={(e) => addPendingFiles(e.target.files)}
                  />

                  {pendingFiles.length > 0 && (
                    <ul className="mb-3 flex flex-col gap-2">
                      {pendingFiles.map((file) => (
                        <li
                          key={`${file.name}-${file.size}`}
                          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                        >
                          {mode === 'images' ? (
                            <ImageIcon size={16} className="text-[#e8a838]" aria-hidden />
                          ) : (
                            <FileText size={16} className="text-[#7eb6ff]" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1 truncate text-[13px] text-white/80">
                            {file.name}
                          </span>
                          <span className="font-[family-name:var(--font-mono)] text-[10px] text-white/35">
                            {(file.size / 1024).toFixed(0)} KB
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setPendingFiles((prev) =>
                                prev.filter(
                                  (f) => !(f.name === file.name && f.size === file.size),
                                ),
                              )
                            }
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
                            aria-label={`Quitar ${file.name}`}
                          >
                            <X size={14} aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || apiStatus === 'offline'}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 text-sm text-white/85 transition-colors hover:border-white/30 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Upload size={16} aria-hidden />
                      Elegir archivos
                    </button>
                    <button
                      type="button"
                      disabled={busy || apiStatus === 'offline' || pendingFiles.length === 0}
                      onClick={() => void confirmUpload()}
                      className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-[#4eebc8] px-4 text-sm font-medium text-[#050608] transition-all hover:scale-[1.02] hover:bg-[#6ff0d4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                    >
                      {uploading ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden />
                      ) : (
                        <Sparkles size={16} aria-hidden />
                      )}
                      {uploading
                        ? 'Indexando…'
                        : `Indexar ${pendingFiles.length || ''}`.trim()}
                    </button>
                    <p className="ml-auto text-[12px] text-white/40">
                      {pendingFiles.length
                        ? `${pendingFiles.length} listo(s)`
                        : 'Arrastra aquí o elige archivos'}
                    </p>
                  </div>
                </div>
              )}

              <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] text-white/30">
                {mode === 'chat' &&
                  (selectedDoc
                    ? `Solo busca en: ${selectedDoc}`
                    : 'Enter para enviar · busca en todos los archivos')}
                {mode === 'images' && 'Modo imágenes · indexa figuras en Qdrant'}
                {mode === 'documents' && 'Modo documentos · LlamaParse + embeddings'}
              </p>
            </div>
          </div>
        </main>

        <aside className="hidden w-[320px] shrink-0 border-l border-white/10 bg-white/[0.015] p-5 lg:block xl:w-[360px]">
          <SourcePanel
            textSources={latest?.text_sources ?? []}
            imageSources={latest?.image_sources ?? []}
          />
        </aside>
      </div>

      <div
        className={`fixed inset-0 z-40 lg:hidden ${
          sourcesOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <button
          type="button"
          className={`absolute inset-0 cursor-pointer bg-black/60 transition-opacity duration-300 ${
            sourcesOpen ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Cerrar panel de fuentes"
          onClick={() => setSourcesOpen(false)}
        />
        <div
          className={`absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-white/10 bg-[#050608] p-5 shadow-2xl transition-transform duration-300 ease-out ${
            sourcesOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Fuentes recuperadas"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="font-[family-name:var(--font-display)] font-semibold">
              Fuentes
            </span>
            <button
              type="button"
              onClick={() => setSourcesOpen(false)}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/15 transition-colors duration-200 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
              aria-label="Cerrar"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SourcePanel
              textSources={latest?.text_sources ?? []}
              imageSources={latest?.image_sources ?? []}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
