'use client'

import { useEffect, useRef, useId, ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** When true, focus the last focusable element (safe action) on open. */
  destructive?: boolean
  /** Optional id of the element that labels the dialog. Defaults to generated id. */
  labelledBy?: string
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function Modal({
  open,
  onClose,
  title,
  children,
  destructive = false,
  labelledBy,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const generatedId = useId()
  const titleId = labelledBy ?? `modal-title-${generatedId}`

  // Focus restore + initial focus + scroll lock
  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    const dialog = dialogRef.current
    if (dialog) {
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      )
      const target = destructive
        ? focusables[focusables.length - 1]
        : focusables[0]
      ;(target ?? dialog).focus()
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
      previouslyFocused.current?.focus?.()
    }
  }, [open, destructive])

  // Escape + focus trap
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)

      if (focusables.length === 0) {
        e.preventDefault()
        dialog.focus()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last || !dialog.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl outline-none"
      >
        <h2 id={titleId} className="text-lg font-semibold text-zinc-100">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
