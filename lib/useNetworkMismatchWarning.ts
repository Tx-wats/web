import { useCallback, useEffect, useState } from 'react'
import type { Network } from '@/types'

/** Freighter's network names for the networks the app supports. */
const FREIGHTER_NETWORKS: Record<Network, string> = {
  testnet: 'TESTNET',
  mainnet: 'PUBLIC',
  futurenet: 'FUTURENET',
}

/** Warning text for a wallet/contract network mismatch, or null when they agree. */
export function networkMismatchWarning(walletNetwork: string, network: Network): string | null {
  if (walletNetwork === FREIGHTER_NETWORKS[network]) return null
  return `Your wallet is on ${walletNetwork}, but this contract is on ${network.toUpperCase()}`
}

/**
 * Warns when the connected wallet's network does not match the selected
 * contract network.
 *
 * The check runs on mount, whenever the selected network changes, and whenever
 * the connection state changes (e.g. after connecting from this page), and the
 * warning is cleared when the wallet is no longer reachable.
 */
export function useNetworkMismatchWarning(network: Network, isConnected: boolean) {
  const [networkWarning, setNetworkWarning] = useState<string | null>(null)

  const checkNetworkMismatch = useCallback(async () => {
    if (typeof window === 'undefined' || !window.freighter) {
      // No extension: there is no wallet network to compare against.
      setNetworkWarning(null)
      return
    }
    try {
      const walletNetwork = await window.freighter.getNetwork()
      setNetworkWarning(networkMismatchWarning(walletNetwork, network))
    } catch {
      // Locked or disconnected wallet: nothing to warn about.
      setNetworkWarning(null)
    }
  }, [network])

  useEffect(() => {
    let active = true

    async function run() {
      if (typeof window === 'undefined' || !window.freighter) {
        if (active) setNetworkWarning(null)
        return
      }
      try {
        const walletNetwork = await window.freighter.getNetwork()
        if (active) setNetworkWarning(networkMismatchWarning(walletNetwork, network))
      } catch {
        if (active) setNetworkWarning(null)
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [network, isConnected])

  const clearNetworkWarning = useCallback(() => setNetworkWarning(null), [])

  return { networkWarning, checkNetworkMismatch, clearNetworkWarning }
}
