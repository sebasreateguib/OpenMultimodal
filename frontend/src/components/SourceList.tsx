import type { SourceItem } from '../types/api'

interface SourceListProps {
  title: string
  sources: SourceItem[]
  emptyLabel: string
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

export function SourceList({ title, sources, emptyLabel }: SourceListProps) {
  return (
    <section className="source-list" aria-label={title}>
      <h3 className="source-list__title">
        {title}
        <span className="source-list__count">{sources.length}</span>
      </h3>

      {sources.length === 0 ? (
        <p className="source-list__empty">{emptyLabel}</p>
      ) : (
        <ul className="source-list__items">
          {sources.map((source, index) => (
            <li key={`${source.file_path ?? 'src'}-${index}`} className="source-card">
              <div className="source-card__meta">
                <span className="source-card__file" title={source.file_path ?? undefined}>
                  {fileName(source.file_path)}
                </span>
                {source.source_page != null && (
                  <span className="source-card__page">p. {String(source.source_page)}</span>
                )}
                <span className="source-card__score">score {formatScore(source.score)}</span>
              </div>
              {source.text_preview && (
                <p className="source-card__preview">{source.text_preview}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
