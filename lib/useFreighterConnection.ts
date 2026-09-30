'use client'

import { useEffect, useState } from 'react'
import { subscribeWallet } from '@/lib/walletEvents'

export function useFreighterConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function checkConnection() {
      try {
        if (!window.freighter) {
          setIsConnected(false)
          setLoading(false)
          return
        }
        const connected = await window.freighter.isConnected()
        if (connected) {
          const key = await window.freighter.getPublicKey()
          if (cancelled) return
          setPublicKey(key)
          setIsConnected(true)
        } else {
          setIsConnected(false)
        }
      } catch {
        setIsConnected(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    checkConnection()

    return () => {
      cancelled = true
    }
  }, [])

  // The probe above only covers this mount; a disconnect made in the header
  // has to re-open the connect button this hook's gate is hiding.
  useEffect(
    () =>
      subscribeWallet((key) => {
        setPublicKey(key)
        setIsConnected(Boolean(key))
        setLoading(false)
      }),
    []
  )

  return { isConnected, publicKey, loading }
}
