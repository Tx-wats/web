import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi, beforeEach, afterEach } from 'vitest'
import CopyButton from '../components/CopyButton'

describe('CopyButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders a button with default aria-label', () => {
    render(<CopyButton text="hello" />)
    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeInTheDocument()
  })

  it('renders a button with custom aria-label', () => {
    render(<CopyButton text="hello" aria-label="Copy contract ID" />)
    expect(screen.getByRole('button', { name: 'Copy contract ID' })).toBeInTheDocument()
  })

  it('has type="button" to prevent accidental form submission', () => {
    render(<CopyButton text="hello" />)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('uses navigator.clipboard when available and announces success', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })

    render(<CopyButton text="test-text" />)
    const btn = screen.getByRole('button')

    await act(async () => {
      fireEvent.click(btn)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-text')
    // aria-live region should announce success
    expect(screen.getByRole('status')).toHaveTextContent('Copied!')
  })

  it('falls back to execCommand when clipboard API is unavailable', async () => {
    // Remove clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })

    const execCommandMock = vi.fn().mockReturnValue(true)
    document.execCommand = execCommandMock

    render(<CopyButton text="fallback-text" />)
    const btn = screen.getByRole('button')

    await act(async () => {
      fireEvent.click(btn)
    })

    expect(execCommandMock).toHaveBeenCalledWith('copy')
    expect(screen.getByRole('status')).toHaveTextContent('Copied!')
  })

  it('shows error state when both clipboard methods fail', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    document.execCommand = vi.fn().mockReturnValue(false)

    render(<CopyButton text="fail-text" />)
    const btn = screen.getByRole('button')

    await act(async () => {
      fireEvent.click(btn)
    })

    expect(screen.getByRole('status')).toHaveTextContent('Copy failed')
  })

  it('resets to idle state after 1500ms', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })

    render(<CopyButton text="reset-text" />)
    const btn = screen.getByRole('button')

    await act(async () => {
      fireEvent.click(btn)
    })

    expect(screen.getByRole('status')).toHaveTextContent('Copied!')

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('clears the timeout on unmount (no state-update-after-unmount warning)', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })

    const { unmount } = render(<CopyButton text="unmount-text" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    // Unmount before the 1500ms timer fires — should not throw
    act(() => {
      unmount()
    })

    // Advance time to confirm no errors from setting state on unmounted component
    act(() => {
      vi.advanceTimersByTime(2000)
    })
  })
})
