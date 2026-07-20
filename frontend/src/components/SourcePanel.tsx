import type { ReactNode } from 'react'
import type { SourceItem } from '../types/api'
import { FileText, ImageIcon } from 'lucide-react'

interface SourcePanelProps {
  textSources: SourceItem[]
  imageSources: SourceItem[]
}

function formatScore(score?: number | null): string {
  if (score == null) return '—'
  return score.toFixed(3)
}

function fileName(path?: string | null): string {
  if (!path) return 'Fuente desconocida'
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

function SourceGroup({
  title,
  icon,
  sources,
  emptyLabel,
}: {
  title: string
  icon: ReactNode
  sources: SourceItem[]
  emptyLabel: string
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-body)] text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
        {icon}
        {title}
        <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-[#4eebc8]/15 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-[#4eebc8]">
          {sources.length}
        </span>
      </h3>

      {sources.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-white/35">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {sources.map((source, index) => (
            <li
              key={`${source.file_path ?? 'src'}-${index}`}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.05]"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-[family-name:var(--font-mono)] text-[10px] text-white/45">
                <span className="max-w-[12rem] truncate font-medium text-white/80" title={source.file_path ?? undefined}>
                  {fileName(source.file_path)}
                </span>
                {source.source_page != null && <span>p. {String(source.source_page)}</span>}
                <span className="text-[#4eebc8]/80">score {formatScore(source.score)}</span>
              </div>
              {source.text_preview && (
                <p className="line-clamp-4 text-[12px] leading-relaxed text-white/55">
                  {source.text_preview}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function SourcePanel({ textSources, imageSources }: SourcePanelProps) {
  return (
    <aside className="flex h-full flex-col gap-6 overflow-y-auto">
      <header>
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#4eebc8]">
          Evidencia
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
          Fuentes recuperadas
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-white/45">
          Fragmentos de texto e imágenes usados por Gemini VLM en la última respuesta.
        </p>
      </header>

      <SourceGroup
        title="Texto"
        icon={<FileText size={14} className="text-[#4eebc8]" aria-hidden />}
        sources={textSources}
        emptyLabel="Aún no hay fuentes de texto."
      />

      <div className="border-t border-white/10" />

      <SourceGroup
        title="Imágenes"
        icon={<ImageIcon size={14} className="text-[#e8a838]" aria-hidden />}
        sources={imageSources}
        emptyLabel="Aún no hay fuentes visuales."
      />
    </aside>
  )
}
