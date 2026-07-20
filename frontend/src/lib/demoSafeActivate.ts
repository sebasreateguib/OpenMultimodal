import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react'

/**
 * Screen-recording apps (Recordly, Loom, etc.) often swallow `click`
 * while still delivering pointer/mouse down/up. Fire once from any path.
 */
export function useDemoSafeActivate(handler: () => void, disabled = false) {
  const lastFire = useRef(0)

  const fire = useCallback(() => {
    if (disabled) return
    const now = Date.now()
    if (now - lastFire.current < 350) return
    lastFire.current = now
    handler()
  }, [disabled, handler])

  return {
    onClick: (e: MouseEvent) => {
      e.preventDefault()
      fire()
    },
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return
      // Capture early — some overlays eat the later click/pointerup.
      fire()
    },
    onPointerUp: (e: PointerEvent) => {
      if (e.button !== 0) return
      fire()
    },
    onMouseDown: (e: MouseEvent) => {
      if (e.button !== 0) return
      fire()
    },
  }
}
