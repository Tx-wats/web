import { useState, useEffect } from 'react'
import { readFreighterConnection } from '@/lib/freighter'

export function useFreighterConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkConnection()
  }, [])

  async function checkConnection() {
    try {
      const connection = await readFreighterConnection()
      setPublicKey(connection?.publicKey ?? null)
      setIsConnected(Boolean(connection?.publicKey))
    } catch {
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }

  return { isConnected, publicKey, loading }
}
