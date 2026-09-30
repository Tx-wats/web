'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  /** If true, only exact path matches are considered active (default: false, prefix match) */
  exact?: boolean
}

/**
 * A client-side navigation link that highlights when its route is active.
 * Uses prefix matching by default so /contracts/* highlights the Contracts link.
 * Pass exact={true} for routes that should only match their exact path.
 */
export default function NavLink({ href, children, className = '', exact = false }: NavLinkProps) {
  const pathname = usePathname()

  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={[
        'transition-colors',
        isActive
          ? 'text-zinc-100 font-medium'
          : 'text-zinc-400 hover:text-zinc-100',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Link>
  )
}
