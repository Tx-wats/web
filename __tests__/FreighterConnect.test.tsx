import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FreighterConnect from '@/components/FreighterConnect'

describe('FreighterConnect', () => {
  beforeEach(() => {
    delete (window as any).freighter
    delete (window as any).__freighterPublicKey
    // the component persists the key, so without this later tests start connected
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('connection states', () => {
    it('renders connect button when not connected', async () => {
      render(<FreighterConnect />)
      expect(
        await screen.findByRole('button', { name: /Connect Freighter/ })
      ).toBeInTheDocument()
    })

    it('renders connected state with public key', async () => {
      const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      ;(window as any).freighter = {
        isConnected: vi.fn().mockResolvedValue(true),
        getPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
        getNetwork: vi.fn().mockResolvedValue('TESTNET'),
      }

      render(<FreighterConnect />)

      await waitFor(() => {
        expect(screen.getByText(/GAAA\.\.\.AAAA/)).toBeInTheDocument()
      })
    })

    it('shows disconnect button when connected', async () => {
      const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      ;(window as any).freighter = {
        isConnected: vi.fn().mockResolvedValue(true),
        getPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
        getNetwork: vi.fn().mockResolvedValue('TESTNET'),
      }

      render(<FreighterConnect />)

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument()
      })
    })

    it('disconnects when disconnect button is clicked', async () => {
      const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      ;(window as any).freighter = {
        isConnected: vi.fn().mockResolvedValue(true),
        getPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
        getNetwork: vi.fn().mockResolvedValue('TESTNET'),
      }

      render(<FreighterConnect />)

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Disconnect'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Connect Freighter/ })).toBeInTheDocument()
      })
    })
  })

  describe('rejection handling', () => {
    it('shows error when user rejects connection', async () => {
      ;(window as any).freighter = {
        isConnected: vi.fn().mockResolvedValue(false),
        getPublicKey: vi.fn().mockRejectedValue(new Error('User rejected')),
        getNetwork: vi.fn().mockResolvedValue('TESTNET'),
      }

      render(<FreighterConnect />)

      fireEvent.click(await screen.findByRole('button', { name: /Connect Freighter/ }))

      await waitFor(() => {
        expect(screen.getByText('User rejected')).toBeInTheDocument()
      })
    })

    it('clears error when user tries again', async () => {
      ;(window as any).freighter = {
        isConnected: vi.fn().mockResolvedValue(false),
        getPublicKey: vi
          .fn()
          .mockRejectedValueOnce(new Error('User rejected'))
          .mockResolvedValueOnce('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
        getNetwork: vi.fn().mockResolvedValue('TESTNET'),
      }

      render(<FreighterConnect />)

      fireEvent.click(await screen.findByRole('button', { name: /Connect Freighter/ }))

      await waitFor(() => {
        expect(screen.getByText('User rejected')).toBeInTheDocument()
      })

      fireEvent.click(await screen.findByRole('button', { name: /Connect Freighter/ }))

      await waitFor(() => {
        expect(screen.queryByText('Connection rejected')).not.toBeInTheDocument()
      })
    })
  })

  describe('unavailable extension', () => {
    it('shows error and install link when extension is not installed', async () => {
      delete (window as any).freighter

      render(<FreighterConnect />)

      fireEvent.click(await screen.findByRole('button', { name: /Connect Freighter/ }))

      await waitFor(() => {
        expect(screen.getByText(/Freighter not installed/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Install Freighter/i })).toHaveAttribute(
          'href',
          'https://www.freighter.app/'
        )
        expect(screen.getByRole('button', { name: /check again/i })).toBeInTheDocument()
      })
    })

    it('allows retrying detection after extension is installed', async () => {
      delete (window as any).freighter

      render(<FreighterConnect />)

      fireEvent.click(await screen.findByRole('button', { name: /Connect Freighter/ }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /check again/i })).toBeInTheDocument()
      })

      // Simulate extension installation
      const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      ;(window as any).freighter = {
        isConnected: vi.fn().mockResolvedValue(true),
        getPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
        getNetwork: vi.fn().mockResolvedValue('TESTNET'),
      }

      fireEvent.click(screen.getByRole('button', { name: /check again/i }))

      await waitFor(() => {
        expect(screen.getByText(/GAAA\.\.\.AAAA/)).toBeInTheDocument()
        expect(screen.getByText('TESTNET')).toBeInTheDocument()
      })
    })
  })

  describe('callbacks', () => {
    it('calls onConnect callback when connection succeeds', async () => {
      const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      const onConnect = vi.fn()
      ;(window as any).freighter = {
        isConnected: vi.fn().mockResolvedValue(false),
        getPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
        getNetwork: vi.fn().mockResolvedValue('TESTNET'),
      }

      render(<FreighterConnect onConnect={onConnect} />)

      fireEvent.click(await screen.findByRole('button', { name: /Connect Freighter/ }))

      await waitFor(() => {
        expect(onConnect).toHaveBeenCalledWith(mockPublicKey)
      })
    })

    it('calls onConnect callback on initial mount if already connected', async () => {
      const mockPublicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      const onConnect = vi.fn()
      ;(window as any).freighter = {
        isConnected: vi.fn().mockResolvedValue(true),
        getPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
        getNetwork: vi.fn().mockResolvedValue('TESTNET'),
      }

      render(<FreighterConnect onConnect={onConnect} />)

      await waitFor(() => {
        expect(onConnect).toHaveBeenCalledWith(mockPublicKey)
      })
    })
  })

  describe('loading state', () => {
    it('disables button while connecting', async () => {
      ;(window as any).freighter = {
        isConnected: vi.fn().mockResolvedValue(false),
        getPublicKey: vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('GAAAA...'), 100))
        ),
      }

      render(<FreighterConnect />)

      const button = await screen.findByRole('button', { name: /Connect Freighter/ })
      fireEvent.click(button)

      await waitFor(() => {
        expect(button).toBeDisabled()
      })
    })
  })
})
