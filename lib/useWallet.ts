import { useState, useEffect } from 'react'
import { readFreighterConnection } from '@/lib/freighter'

export function useWallet() {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    let cancelled = false

    readFreighterConnection()
      .then((connection) => {
        if (cancelled) return
        setPublicKey(connection?.publicKey ?? null)
        setIsConnected(Boolean(connection?.publicKey))
      })
      .catch(() => {
        if (cancelled) return
        setPublicKey(null)
        setIsConnected(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { publicKey, isConnected }
}
