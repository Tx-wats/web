import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import WalletStatusBadge from '@/components/WalletStatusBadge'

describe('WalletStatusBadge', () => {
  beforeEach(() => {
    delete (window as any).freighter
    vi.clearAllMocks()
  })

  it('initially renders checking state', () => {
    ;(window as any).freighter = {
      isConnected: vi.fn().mockReturnValue(new Promise(() => {})),
    }

    render(<WalletStatusBadge />)
    expect(screen.getByText('Checking…')).toBeInTheDocument()
  })

  it('renders connected when isConnected resolves true', async () => {
    ;(window as any).freighter = {
      isConnected: vi.fn().mockResolvedValue(true),
    }

    render(<WalletStatusBadge />)
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
  })

  it('renders disconnected when isConnected resolves false', async () => {
    ;(window as any).freighter = {
      isConnected: vi.fn().mockResolvedValue(false),
    }

    render(<WalletStatusBadge />)
    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })
  })

  it('falls back to disconnected when isConnected rejects', async () => {
    ;(window as any).freighter = {
      isConnected: vi.fn().mockRejectedValue(new Error('Extension error')),
    }

    render(<WalletStatusBadge />)
    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })
  })

  it('renders unavailable when window.freighter is not present', async () => {
    delete (window as any).freighter

    render(<WalletStatusBadge />)
    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    })
  })
})
