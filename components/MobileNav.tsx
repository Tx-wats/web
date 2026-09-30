'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { links as repoLinks } from '@/lib/links'
import WalletStatusBadge from '@/components/WalletStatusBadge'
import FreighterConnect from '@/components/FreighterConnect'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/contracts', label: 'Contracts' },
  { href: '/settings', label: 'Settings' },
  { href: repoLinks.org, label: 'GitHub', external: true },
]

// Selectors for all keyboard-focusable elements inside a container.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Ref for the trigger button so we can restore focus on close.
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Ref for the drawer panel so we can trap focus inside it.
  const drawerRef = useRef<HTMLDivElement>(null)

  /** Open the drawer and move focus into it on the next tick. */
  const openDrawer = useCallback(() => {
    setOpen(true)
  }, [])

  /** Close the drawer and return focus to the trigger button. */
  const closeDrawer = useCallback(() => {
    setOpen(false)
    // Restore focus to the hamburger trigger after the drawer unmounts.
    triggerRef.current?.focus()
  }, [])

  // Close on route change (browser back, Link navigation, etc.)
  useEffect(() => {
    if (open) closeDrawer()
    // Only run when pathname changes — intentionally omitting `closeDrawer`
    // from the dep array because we only want the pathname change to trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Move initial focus into the drawer when it opens.
  useEffect(() => {
    if (!open || !drawerRef.current) return
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
    focusable[0]?.focus()
  }, [open])

  /**
   * Focus trap: when the user tabs past the last focusable element, wrap back
   * to the first; Shift+Tab past the first wraps to the last.
   * Also closes on Escape.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDrawer()
        return
      }

      if (e.key !== 'Tab' || !drawerRef.current) return

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null) // visible only

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [closeDrawer],
  )

  const drawerId = 'mobile-nav-drawer'

  return (
    <div className="sm:hidden">
      {/* Hamburger trigger */}
      <button
        ref={triggerRef}
        onClick={openDrawer}
        aria-expanded={open}
        aria-controls={drawerId}
        aria-label="Open menu"
        className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop — clicking it closes the drawer */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            id={drawerId}
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            onKeyDown={handleKeyDown}
            className="fixed top-0 right-0 z-50 h-full w-64 bg-zinc-900 border-l border-zinc-800 p-6 flex flex-col gap-6 animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-100">Menu</span>
              <button
                onClick={closeDrawer}
                aria-label="Close menu"
                className="text-zinc-500 hover:text-zinc-100 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <nav aria-label="Mobile navigation">
              <ul className="flex flex-col gap-4 list-none m-0 p-0">
                {navLinks.map((l) =>
                  l.external ? (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-300 hover:text-zinc-100 transition-colors"
                        onClick={closeDrawer}
                      >
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        aria-current={pathname === l.href ? 'page' : undefined}
                        className={`transition-colors ${
                          pathname === l.href
                            ? 'text-zinc-100 font-semibold'
                            : 'text-zinc-300 hover:text-zinc-100'
                        }`}
                        onClick={closeDrawer}
                      >
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </nav>
            <div className="pt-4 border-t border-zinc-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-medium">Wallet Status</span>
                <WalletStatusBadge />
              </div>
              <FreighterConnect />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
