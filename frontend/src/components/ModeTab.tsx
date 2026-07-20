import type { LucideIcon } from 'lucide-react'
import { useDemoSafeActivate } from '../lib/demoSafeActivate'

interface ModeTabProps {
  id: string
  label: string
  selected: boolean
  disabled: boolean
  icon: LucideIcon
  onSelect: () => void
}

export function ModeTab({ id, label, selected, disabled, icon: Icon, onSelect }: ModeTabProps) {
  const activate = useDemoSafeActivate(onSelect, disabled)

  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      disabled={disabled}
      {...activate}
      className={`relative z-40 inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-[12px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4eebc8] disabled:cursor-not-allowed disabled:opacity-50 sm:text-[13px] ${
        selected
          ? 'bg-white text-[#050608]'
          : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
      }`}
    >
      <Icon size={15} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
