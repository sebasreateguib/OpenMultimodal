import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useDemoSafeActivate } from '../lib/demoSafeActivate'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  onActivate: () => void
  children: ReactNode
}

/** Button that still works when a screen recorder swallows the `click` event. */
export function DemoSafeButton({
  onActivate,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: Props) {
  const activate = useDemoSafeActivate(onActivate, Boolean(disabled))

  return (
    <button
      type={type}
      disabled={disabled}
      className={className}
      {...rest}
      {...activate}
    >
      {children}
    </button>
  )
}
