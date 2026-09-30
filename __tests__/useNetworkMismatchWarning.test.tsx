import { vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  networkMismatchWarning,
  useNetworkMismatchWarning,
} from '@/lib/useNetworkMismatchWarning'

describe('networkMismatchWarning', () => {
  it('maps Freighter network names and warns on mismatch', () => {
    expect(networkMismatchWarning('TESTNET', 'testnet')).toBeNull()
    expect(networkMismatchWarning('PUBLIC', 'mainnet')).toBeNull()
    expect(networkMismatchWarning('FUTURENET', 'futurenet')).toBeNull()
    expect(networkMismatchWarning('PUBLIC', 'testnet')).toBe(
      'Your wallet is on PUBLIC, but this contract is on TESTNET'
    )
    expect(networkMismatchWarning('TESTNET', 'mainnet')).toBe(
      'Your wallet is on TESTNET, but this contract is on MAINNET'
    )
  })
})

describe('useNetworkMismatchWarning', () => {
  beforeEach(() => {
    delete (window as any).freighter
    vi.clearAllMocks()
  })

  it('warns on the initial mount when the wallet network differs', async () => {
    ;(window as any).freighter = { getNetwork: vi.fn().mockResolvedValue('PUBLIC') }

    const { result } = renderHook(() => useNetworkMismatchWarning('testnet', true))

    await waitFor(() =>
      expect(result.current.networkWarning).toBe(
        'Your wallet is on PUBLIC, but this contract is on TESTNET'
      )
    )
  })

  it('stays quiet on mount when the networks match', async () => {
    ;(window as any).freighter = { getNetwork: vi.fn().mockResolvedValue('TESTNET') }

    const { result } = renderHook(() => useNetworkMismatchWarning('testnet', true))

    await waitFor(() => expect((window as any).freighter.getNetwork).toHaveBeenCalled())
    expect(result.current.networkWarning).toBeNull()
  })

  it('re-checks when the selected network changes', async () => {
    ;(window as any).freighter = { getNetwork: vi.fn().mockResolvedValue('TESTNET') }

    const { result, rerender } = renderHook(
      ({ network }: { network: 'testnet' | 'mainnet' }) =>
        useNetworkMismatchWarning(network, true),
      { initialProps: { network: 'testnet' as const } }
    )

    await waitFor(() => expect(result.current.networkWarning).toBeNull())

    rerender({ network: 'mainnet' })

    await waitFor(() =>
      expect(result.current.networkWarning).toBe(
        'Your wallet is on TESTNET, but this contract is on MAINNET'
      )
    )
  })

  it('warns after the wallet connects, without waiting for a network change', async () => {
    // No extension yet: the page renders the Connect button and has no wallet
    // network to compare against.
    const { result, rerender } = renderHook(
      ({ connected }: { connected: boolean }) => useNetworkMismatchWarning('testnet', connected),
      { initialProps: { connected: false } }
    )

    expect(result.current.networkWarning).toBeNull()

    ;(window as any).freighter = {
      getNetwork: vi.fn().mockResolvedValue('PUBLIC'),
      getPublicKey: vi.fn().mockResolvedValue('GABC'),
      isConnected: vi.fn().mockResolvedValue(true),
    }
    rerender({ connected: true })

    await waitFor(() =>
      expect(result.current.networkWarning).toBe(
        'Your wallet is on PUBLIC, but this contract is on TESTNET'
      )
    )
  })

  it('checks immediately when asked, e.g. from the connect handler', async () => {
    const { result } = renderHook(() => useNetworkMismatchWarning('testnet', true))
    expect(result.current.networkWarning).toBeNull()

    ;(window as any).freighter = { getNetwork: vi.fn().mockResolvedValue('PUBLIC') }
    await result.current.checkNetworkMismatch()

    await waitFor(() =>
      expect(result.current.networkWarning).toBe(
        'Your wallet is on PUBLIC, but this contract is on TESTNET'
      )
    )
  })

  it('clears the warning when the wallet disconnects', async () => {
    ;(window as any).freighter = { getNetwork: vi.fn().mockResolvedValue('PUBLIC') }

    const { result } = renderHook(() => useNetworkMismatchWarning('testnet', true))
    await waitFor(() => expect(result.current.networkWarning).not.toBeNull())

    result.current.clearNetworkWarning()

    expect(result.current.networkWarning).toBeNull()
  })

  it('clears the warning when getNetwork rejects (locked or disconnected wallet)', async () => {
    ;(window as any).freighter = { getNetwork: vi.fn().mockResolvedValue('PUBLIC') }

    const { result, rerender } = renderHook(
      ({ network }: { network: 'testnet' | 'mainnet' }) =>
        useNetworkMismatchWarning(network, true),
      { initialProps: { network: 'testnet' as const } }
    )
    await waitFor(() => expect(result.current.networkWarning).not.toBeNull())

    ;(window as any).freighter = { getNetwork: vi.fn().mockRejectedValue(new Error('locked')) }
    rerender({ network: 'mainnet' })

    await waitFor(() => expect(result.current.networkWarning).toBeNull())
  })
})
