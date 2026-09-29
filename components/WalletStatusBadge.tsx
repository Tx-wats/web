'use client'

import { useState, useEffect } from 'react'
import { readFreighterConnection } from '@/lib/freighter'

type WalletStatus = 'connected' | 'disconnected' | 'unavailable'

export default function WalletStatusBadge() {
  const [status, setStatus] = useState<WalletStatus>('unavailable')

  useEffect(() => {
    let cancelled = false

    readFreighterConnection()
      .then((connection) => {
        if (cancelled) return
        if (!connection) {
          setStatus('unavailable')
          return
        }
        setStatus(connection.publicKey ? 'connected' : 'disconnected')
      })
      .catch(() => {
        if (!cancelled) setStatus('disconnected')
      })

    return () => {
      cancelled = true
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
