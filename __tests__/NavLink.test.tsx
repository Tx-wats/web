import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

// Mock next/navigation usePathname
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

// Mock next/link so it renders a plain <a>
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { usePathname } from 'next/navigation'
import NavLink from '../components/NavLink'

const mockPathname = usePathname as ReturnType<typeof vi.fn>

describe('NavLink', () => {
  it('renders a link with the correct href', () => {
    mockPathname.mockReturnValue('/dashboard')
    render(<NavLink href="/dashboard">Dashboard</NavLink>)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
  })

  it('sets aria-current="page" on the active route', () => {
    mockPathname.mockReturnValue('/dashboard')
    render(<NavLink href="/dashboard">Dashboard</NavLink>)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not set aria-current on an inactive route', () => {
    mockPathname.mockReturnValue('/contracts')
    render(<NavLink href="/dashboard">Dashboard</NavLink>)
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })

  it('applies active styles when route matches', () => {
    mockPathname.mockReturnValue('/dashboard')
    render(<NavLink href="/dashboard">Dashboard</NavLink>)
    const link = screen.getByRole('link', { name: 'Dashboard' })
    expect(link.className).toContain('text-zinc-100')
    expect(link.className).toContain('font-medium')
  })

  it('applies inactive styles when route does not match', () => {
    mockPathname.mockReturnValue('/contracts')
    render(<NavLink href="/dashboard">Dashboard</NavLink>)
    const link = screen.getByRole('link', { name: 'Dashboard' })
    expect(link.className).toContain('text-zinc-400')
  })

  it('matches /contracts/* prefix for the Contracts link (prefix match)', () => {
    mockPathname.mockReturnValue('/contracts/some-id')
    render(<NavLink href="/contracts">Contracts</NavLink>)
    expect(screen.getByRole('link', { name: 'Contracts' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not prefix-match /dashboard when exact=true and path is /dashboard/sub', () => {
    mockPathname.mockReturnValue('/dashboard/sub')
    render(<NavLink href="/dashboard" exact>Dashboard</NavLink>)
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })

  it('exact matches /settings when path is exactly /settings', () => {
    mockPathname.mockReturnValue('/settings')
    render(<NavLink href="/settings" exact>Settings</NavLink>)
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  })
})
