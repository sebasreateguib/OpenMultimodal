type Status = 'checking' | 'online' | 'offline'

interface StatusBadgeProps {
  status: Status
}

const labels: Record<Status, string> = {
  checking: 'Conectando…',
  online: 'API en línea',
  offline: 'API sin conexión',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${status}`} role="status">
      <span className="status-badge__dot" aria-hidden="true" />
      {labels[status]}
    </span>
  )
}
