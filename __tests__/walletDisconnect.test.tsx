import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FreighterConnect from '@/components/FreighterConnect'
import WalletStatusBadge from '@/components/WalletStatusBadge'
import { useFreighterConnection } from '@/lib/useFreighterConnection'

const MOCK_PUBLIC_KEY =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const TRUNCATED_KEY = /GAAA\.\.\.AAAA/

function mockFreighter(isConnected: boolean) {
  window.freighter = {
    isConnected: vi.fn().mockResolvedValue(isConnected),
    getPublicKey: vi.fn().mockResolvedValue(MOCK_PUBLIC_KEY),
    getNetwork: vi.fn().mockResolvedValue('TESTNET'),
  }
}

describe('wallet state broadcast', () => {
  beforeEach(() => {
    delete window.freighter
    delete window.__freighterPublicKey
    localStorage.clear()
    vi.clearAllMocks()
  })

  // The header and the landing page each render their own FreighterConnect, so
  // a disconnect in one of them has to reach the other plus the status badge.
  it('updates the badge, both connect buttons and the global on disconnect', async () => {
    mockFreighter(true)

    render(
      <>
        <WalletStatusBadge />
        <FreighterConnect />
        <FreighterConnect />
      </>
    )

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getAllByText(TRUNCATED_KEY)).toHaveLength(2)
    })
    expect(window.__freighterPublicKey).toBe(MOCK_PUBLIC_KEY)

    fireEvent.click(screen.getAllByRole('button', { name: 'Disconnect' })[0])

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /Connect Freighter/ })
      ).toHaveLength(2)
    })
    expect(screen.queryByText(TRUNCATED_KEY)).not.toBeInTheDocument()
    expect(window.__freighterPublicKey).toBeUndefined()
    expect(localStorage.getItem('freighter_public_key')).toBeNull()
  })

  it('updates the badge and the other button on connect', async () => {
    mockFreighter(false)

    render(
      <>
        <WalletStatusBadge />
        <FreighterConnect />
        <FreighterConnect />
      </>
    )

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /Connect Freighter/ })
      ).toHaveLength(2)
    })
    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getAllByRole('button', { name: /Connect Freighter/ })[0]
    )

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getAllByText(TRUNCATED_KEY)).toHaveLength(2)
    })
    expect(
      screen.queryAllByRole('button', { name: /Connect Freighter/ })
    ).toHaveLength(0)
    expect(window.__freighterPublicKey).toBe(MOCK_PUBLIC_KEY)
  })

  it('re-opens the new-contract gate after a disconnect made elsewhere', async () => {
    mockFreighter(true)

    function NewContractGate() {
      const { isConnected } = useFreighterConnection()
      return isConnected ? (
        <p>Connect a wallet to save</p>
      ) : (
        <p>Wallet required</p>
      )
    }

    render(
      <>
        <FreighterConnect />
        <NewContractGate />
      </>
    )

    await waitFor(() => {
      expect(screen.getByText('Connect a wallet to save')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))

    await waitFor(() => {
      expect(screen.getByText('Wallet required')).toBeInTheDocument()
    })
  })

  it('leaves the badge unavailable when the extension is missing', () => {
    delete window.freighter

    render(<WalletStatusBadge />)

    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })
})
