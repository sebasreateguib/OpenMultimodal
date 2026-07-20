import { useEffect, useRef, useState } from 'react'
import { ArrowRight, FileSearch, Menu, Sparkles, X, Zap } from 'lucide-react'
import type Hls from 'hls.js'

const HLS_URL =
  'https://stream.mux.com/tLkHO1qZoaaQOUeVWo8hEBeGQfySP02EPS02BmnNFyXys.m3u8'

const NAV_LINKS = [
  { label: 'HOW', href: '#how-it-works', action: 'scroll' as const },
  { label: 'INGEST', href: '#ingest', action: 'scroll' as const },
  { label: 'QUERY', href: '#query', action: 'chat' as const },
  { label: 'API', href: '#api', action: 'scroll' as const },
] as const

const STACK = [
  'LlamaIndex',
  'LlamaParse',
  'Gemini VLM',
  'gemini-embedding-2',
  'CLIP',
  'Qdrant',
  'FastAPI',
] as const

const SAMPLE_QUERY =
  '¿Cuál es la arquitectura del sistema mostrada en el diagrama?'

function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let hlsInstance: Hls | null = null
    let cancelled = false

    async function setupVideo() {
      const el = videoRef.current
      if (!el || cancelled) return

      el.muted = true
      el.loop = true
      el.playsInline = true

      if (el.canPlayType('application/vnd.apple.mpegurl')) {
        el.src = HLS_URL
        void el.play().catch(() => {})
        return
      }

      const { default: HlsLib } = await import('hls.js')
      if (cancelled || !HlsLib.isSupported()) return

      hlsInstance = new HlsLib({ enableWorker: false })
      hlsInstance.loadSource(HLS_URL)
      hlsInstance.attachMedia(el)
      hlsInstance.on(HlsLib.Events.MANIFEST_PARSED, () => {
        void el.play().catch(() => {})
      })
    }

    void setupVideo()

    return () => {
      cancelled = true
      hlsInstance?.destroy()
    }
  }, [])

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover opacity-60"
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
    />
  )
}

function CentralGlow() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[8%] z-[2] -translate-x-1/2 md:top-[6%]"
      aria-hidden="true"
    >
      <svg
        width="820"
        height="280"
        viewBox="0 0 820 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="max-w-[90vw]"
      >
        <ellipse
          cx="410"
          cy="140"
          rx="380"
          ry="90"
          fill="url(#om-glow)"
          filter="url(#om-blur)"
        />
        <defs>
          <linearGradient id="om-glow" x1="30" y1="140" x2="790" y2="140">
            <stop stopColor="#0a1628" stopOpacity="0" />
            <stop offset="0.3" stopColor="#1a4a6b" stopOpacity="0.75" />
            <stop offset="0.5" stopColor="#4eebc8" stopOpacity="0.45" />
            <stop offset="0.7" stopColor="#e8a838" stopOpacity="0.35" />
            <stop offset="1" stopColor="#0a1628" stopOpacity="0" />
          </linearGradient>
          <filter id="om-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="25" />
          </filter>
        </defs>
      </svg>
    </div>
  )
}

function GridLines() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[3] hidden md:block"
      aria-hidden="true"
    >
      <div className="absolute inset-y-0 left-1/4 w-px bg-white/10" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
      <div className="absolute inset-y-0 left-3/4 w-px bg-white/10" />
    </div>
  )
}

function LiquidGlassCard() {
  return (
    <div className="liquid-glass animate-rise flex h-[200px] w-[200px] shrink-0 flex-col justify-between rounded-2xl p-4">
      <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-widest text-[#4eebc8]">
        [ RAG v0.1 ]
      </span>
      <div>
        <h2 className="text-[18px] leading-snug text-white">
          Index{' '}
          <span className="font-serif italic">text + visuals</span>
        </h2>
        <p className="mt-2 text-[11px] leading-relaxed text-white/55">
          LlamaParse extracts PDFs, diagrams &amp; tables. Embeddings land in
          Qdrant. Gemini VLM synthesizes grounded answers.
        </p>
      </div>
    </div>
  )
}

function StackPills() {
  return (
    <ul
      id="stack"
      className="animate-rise mt-8 flex max-w-2xl flex-wrap gap-2"
      style={{ animationDelay: '520ms' }}
    >
      {STACK.map((item) => (
        <li
          key={item}
          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-white/60"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

export function OpenMultimodalHero({ onOpenChat }: { onOpenChat?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  function handleNav(
    e: React.MouseEvent,
    link: (typeof NAV_LINKS)[number],
  ) {
    if (link.action === 'chat') {
      e.preventDefault()
      setMenuOpen(false)
      onOpenChat?.()
    } else {
      setMenuOpen(false)
    }
  }

  return (
    <section className="relative min-h-dvh overflow-hidden bg-[#050608] text-white">
      <div className="absolute inset-0 z-0">
        <BackgroundVideo />
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#050608] via-[#050608]/75 to-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/45 to-transparent"
          aria-hidden="true"
        />
      </div>

      <CentralGlow />
      <GridLines />

      <header className="absolute inset-x-0 top-0 z-50 px-5 py-5 md:px-10 md:py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <a href="#" className="animate-rise flex items-center gap-2.5 text-white">
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              OpenMultimodal
            </span>
          </a>

          <nav className="hidden items-center gap-10 md:flex">
            {NAV_LINKS.map((link, index) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNav(e, link)}
                className="animate-rise cursor-pointer font-[family-name:var(--font-body)] text-[14px] font-medium tracking-[0.12em] text-white transition-colors duration-200 hover:text-[#4eebc8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
                style={{ animationDelay: `${80 + index * 60}ms` }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <button
            type="button"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/15 text-white transition-colors duration-200 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8] md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[60] bg-[#050608]/98 transition-opacity duration-300 md:hidden ${
          menuOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex h-full flex-col px-6 py-6">
          <div className="flex items-center justify-between">
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold">
              OpenMultimodal
            </span>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="mt-16 flex flex-col gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="cursor-pointer font-[family-name:var(--font-body)] text-2xl font-medium tracking-wide text-white transition-colors duration-200 hover:text-[#4eebc8]"
                onClick={(e) => handleNav(e, link)}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-center px-5 pb-16 pt-28 md:px-10 md:pt-32">
        <p
          className="animate-rise font-[family-name:var(--font-body)] text-[11px] font-bold uppercase tracking-[0.2em] text-[#4eebc8]"
          style={{ animationDelay: '120ms' }}
        >
          Multimodal Retrieval-Augmented Generation
        </p>

        <div className="mt-10 flex flex-col gap-10 sm:mt-12 md:mt-14 md:flex-row md:items-start md:justify-between md:gap-12">
          <div className="min-w-0 flex-1">
            <h1
              className="animate-rise max-w-5xl font-[family-name:var(--font-display)] text-[38px] font-bold uppercase leading-[0.92] tracking-[-0.03em] sm:text-[48px] md:text-[68px] lg:text-[76px]"
              style={{ animationDelay: '200ms' }}
            >
              Ingest docs.
              <br />
              Query text{' '}
              <span className="font-serif italic normal-case text-[#e8a838]">
                &amp; visuals
              </span>
              <span className="text-[#4eebc8]">.</span>
            </h1>

            <p
              className="animate-rise mt-6 max-w-xl text-[14px] leading-relaxed text-white/70 md:text-[15px]"
              style={{ animationDelay: '320ms' }}
            >
              Advanced RAG pipeline with LlamaIndex, LlamaParse, and Google Gemini
              VLM. Parse PDFs, diagrams, and tables — index into Qdrant — answer
              grounded questions with retrieved evidence.
            </p>

            <div
              className="animate-rise mt-6 flex max-w-xl items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              style={{ animationDelay: '400ms' }}
            >
              <FileSearch size={18} className="mt-0.5 shrink-0 text-[#4eebc8]" />
              <div>
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-white/40">
                  Sample query
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/80">
                  &ldquo;{SAMPLE_QUERY}&rdquo;
                </p>
              </div>
            </div>

            <div
              className="animate-rise mt-8 flex flex-wrap gap-3"
              style={{ animationDelay: '480ms' }}
            >
              <button
                type="button"
                onClick={() => onOpenChat?.()}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#4eebc8] px-7 py-3.5 text-[13px] font-bold uppercase tracking-wide text-[#050608] transition-transform duration-200 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
              >
                <Zap size={16} strokeWidth={2.5} />
                Start Querying
                <ArrowRight size={18} strokeWidth={2.5} />
              </button>
              <a
                href="#ingest"
                className="liquid-glass inline-flex cursor-pointer items-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-bold uppercase tracking-wide text-white transition-transform duration-200 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8]"
              >
                <Sparkles size={16} />
                Run Ingest
              </a>
            </div>

            <StackPills />

            <div
              className="animate-rise mt-10 flex flex-wrap gap-x-6 gap-y-2 font-[family-name:var(--font-mono)] text-[10px] text-white/35"
              style={{ animationDelay: '600ms' }}
            >
              <span>
                <span className="text-[#4eebc8]/70">GET</span> /health
              </span>
              <span>
                <span className="text-[#e8a838]/70">POST</span> /api/v1/ingest
              </span>
              <span>
                <span className="text-[#e8a838]/70">POST</span> /api/v1/query
              </span>
            </div>
          </div>

          <div className="flex justify-end md:pt-1">
            <LiquidGlassCard />
          </div>
        </div>
      </div>
    </section>
  )
}
