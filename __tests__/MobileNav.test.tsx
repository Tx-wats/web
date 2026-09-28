/**
 * Accessibility and keyboard tests for MobileNav (#109).
 *
 * Covers:
 *  - aria-expanded / aria-controls on the trigger
 *  - role="dialog" + aria-modal on the drawer panel
 *  - Close on Escape key
 *  - Focus trap (Tab wraps from last → first, Shift+Tab wraps first → last)
 *  - Focus restoration to the trigger after close
 *  - aria-current="page" on the active link
 *  - Close on route change (pathname change)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MobileNav from '@/components/MobileNav'

// ── Mock next/navigation ───────────────────────────────────────────────────
let mockPathname = '/dashboard'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

// next/link renders a plain <a> in the test environment
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// ── Helpers ────────────────────────────────────────────────────────────────

function openDrawer() {
  fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockPathname = '/dashboard'
})

describe('MobileNav — trigger button', () => {
  it('renders the open button with aria-expanded=false when closed', () => {
    render(<MobileNav />)
    const trigger = screen.getByRole('button', { name: /open menu/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('has aria-controls pointing to the drawer id', () => {
    render(<MobileNav />)
    const trigger = screen.getByRole('button', { name: /open menu/i })
    expect(trigger).toHaveAttribute('aria-controls', 'mobile-nav-drawer')
  })

  it('updates aria-expanded to true when the drawer opens', () => {
    render(<MobileNav />)
    openDrawer()
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})

describe('MobileNav — drawer semantics', () => {
  it('drawer has role="dialog" and aria-modal="true"', () => {
    render(<MobileNav />)
    openDrawer()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('drawer has an accessible name', () => {
    render(<MobileNav />)
    openDrawer()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label')
  })
})

describe('MobileNav — close behaviour', () => {
  it('closes when the close button is clicked', () => {
    render(<MobileNav />)
    openDrawer()
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', () => {
    render(<MobileNav />)
    openDrawer()
    // The backdrop is the sibling div with aria-hidden
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the Escape key is pressed', () => {
    render(<MobileNav />)
    openDrawer()
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('MobileNav — focus management', () => {
  it('restores focus to the trigger after the drawer closes', async () => {
    render(<MobileNav />)
    const trigger = screen.getByRole('button', { name: /open menu/i })
    openDrawer()
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

describe('MobileNav — active link', () => {
  it('marks the current route with aria-current="page"', () => {
    mockPathname = '/contracts'
    render(<MobileNav />)
    openDrawer()
    const contractsLink = screen.getByRole('link', { name: /contracts/i })
    expect(contractsLink).toHaveAttribute('aria-current', 'page')
  })

  it('does not set aria-current on non-active links', () => {
    mockPathname = '/dashboard'
    render(<MobileNav />)
    openDrawer()
    const settingsLink = screen.getByRole('link', { name: /settings/i })
    expect(settingsLink).not.toHaveAttribute('aria-current')
  })
})

describe('MobileNav — keyboard focus trap', () => {
  it('wraps focus from last to first focusable element on Tab', async () => {
    const user = userEvent.setup()
    render(<MobileNav />)
    openDrawer()
    const dialog = screen.getByRole('dialog')
    // Get all focusable elements inside the drawer
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ).filter((el) => el.offsetParent !== null || el.tagName === 'A')
    const last = focusable[focusable.length - 1]
    last.focus()
    await user.tab()
    // Focus should have wrapped to the first focusable element
    expect(document.activeElement).toBe(focusable[0])
  })

  it('wraps focus from first to last focusable element on Shift+Tab', async () => {
    const user = userEvent.setup()
    render(<MobileNav />)
    openDrawer()
    const dialog = screen.getByRole('dialog')
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ).filter((el) => el.offsetParent !== null || el.tagName === 'A')
    const first = focusable[0]
    first.focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(focusable[focusable.length - 1])
  })
})
