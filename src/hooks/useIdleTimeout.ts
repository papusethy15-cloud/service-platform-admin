// src/hooks/useIdleTimeout.ts
// Tracks user activity (mouse, keyboard, touch, scroll).
// If no activity for `timeoutMs` milliseconds, calls onIdle().
// Resets the timer on every qualifying event.

import { useEffect, useRef, useCallback } from 'react'

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
  'click',
] as const

interface UseIdleTimeoutOptions {
  /** Idle threshold in milliseconds. Default: 5 minutes */
  timeoutMs?: number
  /** Called once when the user has been idle for timeoutMs */
  onIdle: () => void
  /** Set to false to disable the timer entirely (e.g. on login page) */
  enabled?: boolean
}

export function useIdleTimeout({
  timeoutMs = 5 * 60 * 1000, // 5 minutes
  onIdle,
  enabled = true,
}: UseIdleTimeoutOptions) {
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onIdleRef  = useRef(onIdle)

  // Keep onIdle ref current without re-registering listeners on every render
  useEffect(() => { onIdleRef.current = onIdle }, [onIdle])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onIdleRef.current()
    }, timeoutMs)
  }, [timeoutMs])

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    // Start timer immediately on mount
    resetTimer()

    // Re-start timer on every user activity event
    const handler = () => resetTimer()
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handler, { passive: true })
    )

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handler)
      )
    }
  }, [enabled, resetTimer])
}
