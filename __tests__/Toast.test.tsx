import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, beforeEach, afterEach } from 'vitest'
import Toast from '../components/Toast'

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the message', () => {
    render(<Toast message="Saved!" type="success" />)
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('has role="status" and aria-live="polite"', () => {
    render(<Toast message="Done" type="success" />)
    const toast = screen.getByRole('status')
    expect(toast).toHaveAttribute('aria-live', 'polite')
  })

  it('renders a dismiss button', () => {
    render(<Toast message="Done" type="success" />)
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument()
  })

  it('dismiss button has type="button"', () => {
    render(<Toast message="Done" type="success" />)
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toHaveAttribute('type', 'button')
  })

  it('calls onClose and hides when dismiss button is clicked', () => {
    const onClose = vi.fn()
    render(<Toast message="Done" type="success" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('auto-closes after the duration and calls onClose', () => {
    const onClose = vi.fn()
    render(<Toast message="Auto" type="success" duration={3000} onClose={onClose} />)

    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does NOT restart the timer when onClose reference changes (parent re-render)', () => {
    const onClose1 = vi.fn()
    const onClose2 = vi.fn()

    const { rerender } = render(
      <Toast message="Timer" type="success" duration={4000} onClose={onClose1} />
    )

    // Advance partway — no close yet
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onClose1).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toBeInTheDocument()

    // Re-render with a new onClose reference — must NOT restart the timer
    rerender(<Toast message="Timer" type="success" duration={4000} onClose={onClose2} />)

    // Advance the remaining time to hit the original 4000ms mark
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Timer should have fired exactly once, using the latest onClose ref
    expect(onClose2).toHaveBeenCalledTimes(1)
    expect(onClose1).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders an action button when actionLabel and onAction are provided', () => {
    const onAction = vi.fn()
    render(
      <Toast
        message="Undo?"
        type="success"
        actionLabel="Undo"
        onAction={onAction}
      />
    )
    const actionBtn = screen.getByRole('button', { name: 'Undo' })
    expect(actionBtn).toBeInTheDocument()
    fireEvent.click(actionBtn)
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
