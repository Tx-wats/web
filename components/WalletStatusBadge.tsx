'use client'

import { useEffect, useState } from 'react'
import { subscribeWallet } from '@/lib/walletEvents'

type WalletStatus = 'connected' | 'disconnected' | 'unavailable'

export default function WalletStatusBadge() {
  const [status, setStatus] = useState<WalletStatus>('unavailable')

  useEffect(() => {
    if (!window.freighter) {
      setStatus('unavailable')
      return
    }

    let cancelled = false
    window.freighter.isConnected().then((connected) => {
      if (!cancelled) setStatus(connected ? 'connected' : 'disconnected')
    })

    // The extension probe above only covers this mount. A connect or
    // disconnect triggered anywhere else in the app arrives on the event bus.
    const unsubscribe = subscribeWallet((publicKey) => {
      setStatus(publicKey ? 'connected' : 'disconnected')
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const statusConfig = {
    connected: { color: 'bg-emerald-500', label: 'Connected' },
    disconnected: { color: 'bg-amber-500', label: 'Disconnected' },
    unavailable: { color: 'bg-zinc-600', label: 'Unavailable' },
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800">
      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
      <span className="text-xs text-zinc-400">{config.label}</span>
    </div>
  )
}
