import { useState, useEffect } from 'react'

export function useFreighterConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [network, setNetwork] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function checkConnection() {
      try {
        if (!window.freighter) {
          if (mounted) {
            setIsConnected(false)
            setPublicKey(null)
            setNetwork(null)
            setLoading(false)
          }
          return
        }
        const connected = await window.freighter.isConnected()
        if (connected) {
          const [key, net] = await Promise.all([
            window.freighter.getPublicKey(),
            window.freighter.getNetwork ? window.freighter.getNetwork() : Promise.resolve(null),
          ])
          if (mounted) {
            setPublicKey(key)
            setNetwork(net)
            setIsConnected(true)
          }
        } else {
          if (mounted) {
            setIsConnected(false)
            setPublicKey(null)
            setNetwork(null)
          }
        }
      } catch {
        if (mounted) {
          setIsConnected(false)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    checkConnection()

    const onSync = () => {
      if (!document.hidden) {
        checkConnection()
      }
    }

    const intervalId = setInterval(onSync, 5000)
    window.addEventListener('focus', onSync)
    document.addEventListener('visibilitychange', onSync)

    return () => {
      mounted = false
      clearInterval(intervalId)
      window.removeEventListener('focus', onSync)
      document.removeEventListener('visibilitychange', onSync)
    }
  }, [])

  return { isConnected, publicKey, network, loading }
}
