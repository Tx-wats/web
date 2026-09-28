'use client'

import { useEffect, useRef, useState } from 'react'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  duration?: number
  onClose?: () => void
  actionLabel?: string
  onAction?: () => void
}

/**
 * Toast notification component.
 *
 * Fixes (issue #112):
 * - onClose is stored in a ref so the timer only depends on `duration` and
 *   never restarts on parent re-renders that pass a new inline arrow function.
 * - Adds role="status" / aria-live="polite" so screen readers announce it.
 * - Adds a dismiss button so users can close it immediately.
 * - Uses custom keyframe classes defined in tailwind.config.ts (no plugin needed).
 */
export default function Toast({
  message,
  type,
  duration = 4000,
  onClose,
  actionLabel,
  onAction,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  // Store onClose in a ref so the timer effect does not re-run when a parent
  // re-renders with a new inline arrow function reference.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onCloseRef.current?.()
    }, duration)
    return () => clearTimeout(timer)
    // Intentionally only depends on duration — onClose changes are captured via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  if (!isVisible) return null

  const bgColor =
    type === 'success'
      ? 'bg-emerald-500/10 border-emerald-500/20'
      : 'bg-red-500/10 border-red-500/20'
  const textColor = type === 'success' ? 'text-emerald-400' : 'text-red-400'
  const icon = type === 'success' ? '✓' : '✕'

  function dismiss() {
    setIsVisible(false)
    onCloseRef.current?.()
  }

  function handleAction() {
    onAction?.()
    dismiss()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed bottom-4 right-4 max-w-sm px-4 py-3 rounded-lg border ${bgColor} ${textColor} text-sm flex items-center gap-2 animate-toast-in`}
    >
      <span className="font-bold" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1">{message}</span>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={handleAction}
          className="ml-2 font-semibold underline underline-offset-2 hover:opacity-80"
        >
          {actionLabel}
        </button>
      )}

      {/* Dismiss button */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notification"
        className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
