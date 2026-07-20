import {
  ArrowRight,
  BookOpen,
  Boxes,
  Database,
  FileSearch,
  Layers,
  ScanSearch,
  Sparkles,
  Zap,
} from 'lucide-react'

interface LandingSectionsProps {
  onOpenChat?: () => void
}

const STEPS = [
  {
    id: 'ingest',
    step: '01',
    title: 'Ingest',
    icon: ScanSearch,
    accent: 'text-[#4eebc8]',
    border: 'hover:border-[#4eebc8]/35',
    body: 'Coloca PDFs, diagramas y tablas en data/raw_documents/. LlamaParse extrae texto estructurado y elementos visuales listos para indexar.',
    detail: 'python main.py ingest',
  },
  {
    id: 'index',
    step: '02',
    title: 'Index',
    icon: Database,
    accent: 'text-[#e8a838]',
    border: 'hover:border-[#e8a838]/35',
    body: 'Embeddings de texto (gemini-embedding-2) e imágenes (CLIP o captions Gemini) se almacenan en Qdrant. Cada chunk conserva metadatos de página y archivo.',
    detail: 'Qdrant · multimodal vectors',
  },
  {
    id: 'query',
    step: '03',
    title: 'Query',
    icon: FileSearch,
    accent: 'text-[#4eebc8]',
    border: 'hover:border-[#4eebc8]/35',
    body: 'Recupera Top-K texto + Top-M imágenes y Gemini VLM sintetiza una respuesta grounded con evidencia recuperada.',
    detail: 'POST /api/v1/query',
  },
] as const

const CAPABILITIES = [
  {
    icon: Layers,
    title: 'Texto + visuales',
    body: 'No solo OCR: diagrams, figures y tablas entran al mismo pipeline multimodal.',
  },
  {
    icon: BookOpen,
    title: 'Respuestas grounded',
    body: 'Cada respuesta se apoya en fuentes recuperadas — preview de texto, página y score de similitud.',
  },
  {
    icon: Boxes,
    title: 'API + CLI',
    body: 'Usa FastAPI (/health, /ingest, /query) o el CLI para ingestión y consultas locales.',
  },
] as const

export function LandingSections({ onOpenChat }: LandingSectionsProps) {
  return (
    <>
      <section
        id="how-it-works"
        className="relative border-t border-white/10 bg-[#050608] px-5 py-20 md:px-10 md:py-28"
        aria-labelledby="how-heading"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#4eebc8]/40 to-transparent"
          aria-hidden
        />
        <div className="mx-auto max-w-7xl">
          <p className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.2em] text-[#4eebc8]">
            Pipeline
          </p>
          <h2
            id="how-heading"
            className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            Cómo funciona
            <span className="text-[#4eebc8]">.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/55 md:text-base">
            Tres etapas claras: parsear documentos complejos, indexar texto e
            imágenes, y consultar con un VLM que ve ambas modalidades.
          </p>

          <ol className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
            {STEPS.map((item) => {
              const Icon = item.icon
              return (
                <li
                  key={item.id}
                  id={item.id === 'ingest' ? 'ingest' : undefined}
                  className={`group flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors duration-200 ${item.border}`}
                >
                  <div className="mb-6 flex items-center justify-between">
                    <span
                      className={`font-[family-name:var(--font-mono)] text-[12px] tracking-widest ${item.accent}`}
                    >
                      {item.step}
                    </span>
                    <Icon
                      size={20}
                      className={`${item.accent} opacity-80`}
                      aria-hidden
                    />
                  </div>
                  <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-3 flex-1 text-[14px] leading-relaxed text-white/55">
                    {item.body}
                  </p>
                  <p className="mt-5 font-[family-name:var(--font-mono)] text-[11px] text-white/35">
                    {item.detail}
                  </p>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section
        className="relative border-t border-white/10 bg-[#07090c] px-5 py-20 md:px-10 md:py-28"
        aria-labelledby="capabilities-heading"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <p className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.2em] text-[#e8a838]">
                Capacidades
              </p>
              <h2
                id="capabilities-heading"
                className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl"
              >
                Diseñado para documentos{' '}
                <span className="font-serif italic font-normal text-[#e8a838]">
                  reales
                </span>
                <span className="text-[#4eebc8]">.</span>
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-white/55">
                OpenMultimodal une LlamaIndex, LlamaParse y Google Gemini VLM
                para responder preguntas que mezclan texto, diagramas y tablas
                — no solo embeddings de párrafos.
              </p>
            </div>

            <ul className="flex flex-col gap-4">
              {CAPABILITIES.map((cap) => {
                const Icon = cap.icon
                return (
                  <li
                    key={cap.title}
                    className="flex gap-4 rounded-2xl border border-white/10 bg-[#050608]/60 p-5 transition-colors duration-200 hover:border-white/20"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                      <Icon size={18} className="text-[#4eebc8]" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">
                        {cap.title}
                      </h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-white/55">
                        {cap.body}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="api"
        className="relative border-t border-white/10 bg-[#050608] px-5 py-20 md:px-10 md:py-28"
        aria-labelledby="api-heading"
      >
        <div className="mx-auto max-w-7xl">
          <p className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.2em] text-[#4eebc8]">
            HTTP API
          </p>
          <h2
            id="api-heading"
            className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Endpoints listos
            <span className="text-[#4eebc8]">.</span>
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
            Levanta el servidor con <code className="text-white/70">python main.py --serve</code> y
            conecta el frontend vía proxy Vite o <code className="text-white/70">VITE_API_URL</code>.
          </p>

          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid border-b border-white/10 bg-white/[0.02] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-white/40 sm:grid-cols-[7rem_1fr_1fr]">
              <span className="px-5 py-3">Method</span>
              <span className="hidden px-5 py-3 sm:block">Path</span>
              <span className="hidden px-5 py-3 sm:block">Body</span>
            </div>
            {[
              { method: 'GET', path: '/health', body: '—', tone: 'text-[#4eebc8]' },
              {
                method: 'POST',
                path: '/api/v1/ingest',
                body: '{ "path": null }',
                tone: 'text-[#e8a838]',
              },
              {
                method: 'POST',
                path: '/api/v1/query',
                body: '{ "query": "..." }',
                tone: 'text-[#e8a838]',
              },
            ].map((row) => (
              <div
                key={row.path}
                className="grid gap-1 border-b border-white/10 px-5 py-4 last:border-b-0 sm:grid-cols-[7rem_1fr_1fr] sm:items-center sm:gap-0"
              >
                <span className={`font-[family-name:var(--font-mono)] text-[12px] font-medium ${row.tone}`}>
                  {row.method}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[13px] text-white/80 break-all">
                  {row.path}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[12px] text-white/40">
                  {row.body}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative border-t border-white/10 px-5 py-20 md:px-10 md:py-24"
        aria-labelledby="cta-heading"
      >
        <div className="mx-auto max-w-7xl">
          <div className="liquid-glass relative overflow-hidden rounded-3xl px-6 py-12 sm:px-10 md:px-14 md:py-16">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#4eebc8]/10 blur-3xl"
              aria-hidden
            />
            <div className="relative max-w-2xl">
              <p className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.2em] text-[#4eebc8]">
                Listo para consultar
              </p>
              <h2
                id="cta-heading"
                className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
              >
                Pregunta a tus documentos
                <span className="text-[#4eebc8]">.</span>
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-white/55">
                Abre el chat multimodal, elige una sugerencia o escribe tu propia
                pregunta sobre arquitectura, tablas o figuras.
              </p>
              <button
                type="button"
                onClick={() => onOpenChat?.()}
                className="mt-8 inline-flex h-12 cursor-pointer items-center gap-2 rounded-full bg-[#4eebc8] px-7 text-[13px] font-bold uppercase tracking-wide text-[#050608] transition-transform duration-200 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
              >
                <Zap size={16} strokeWidth={2.5} aria-hidden />
                Start Querying
                <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-white/10 bg-[#050608] px-5 py-10 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight">
            OpenMultimodal
          </p>
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-white/40">
            Multimodal RAG Agent — LlamaIndex, LlamaParse, Gemini VLM &amp; Qdrant.
          </p>
        </div>

        <nav
          className="flex flex-wrap gap-x-6 gap-y-2 font-[family-name:var(--font-body)] text-[12px] tracking-wide text-white/45"
          aria-label="Footer"
        >
          <a
            href="#how-it-works"
            className="cursor-pointer transition-colors duration-200 hover:text-[#4eebc8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
          >
            How it works
          </a>
          <a
            href="#ingest"
            className="cursor-pointer transition-colors duration-200 hover:text-[#4eebc8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
          >
            Ingest
          </a>
          <a
            href="#api"
            className="cursor-pointer transition-colors duration-200 hover:text-[#4eebc8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
          >
            API
          </a>
          <a
            href="#stack"
            className="cursor-pointer transition-colors duration-200 hover:text-[#4eebc8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
          >
            Stack
          </a>
        </nav>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-white/30">
          © {year} OpenMultimodal
        </p>
        <p className="inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] text-white/30">
          <Sparkles size={12} className="text-[#4eebc8]/60" aria-hidden />
          RAG · VLM · Qdrant
        </p>
      </div>
    </footer>
  )
}
