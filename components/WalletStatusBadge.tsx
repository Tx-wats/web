'use client'

import { useState, useEffect } from 'react'

export type WalletStatus = 'checking' | 'connected' | 'disconnected' | 'unavailable'

export default function WalletStatusBadge() {
  const [status, setStatus] = useState<WalletStatus>('checking')

  useEffect(() => {
    let mounted = true

    async function checkStatus() {
      if (typeof window === 'undefined') return
      if (!window.freighter) {
        if (mounted) setStatus('unavailable')
        return
      }

      try {
        const connected = await window.freighter.isConnected()
        if (mounted) {
          setStatus(connected ? 'connected' : 'disconnected')
        }
      } catch {
        if (mounted) {
          setStatus('disconnected')
        }
      }
    }

    checkStatus()

    const handleFocus = () => {
      checkStatus()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      mounted = false
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const statusConfig = {
    checking: { color: 'bg-zinc-500 animate-pulse', label: 'Checking…' },
    connected: { color: 'bg-emerald-500', label: 'Connected' },
    disconnected: { color: 'bg-amber-500', label: 'Disconnected' },
    unavailable: { color: 'bg-zinc-600', label: 'Unavailable' },
  }

  const config = statusConfig[status]

  return (
    <div
      data-testid="wallet-status-badge"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
      <span className="text-xs text-zinc-400">{config.label}</span>
    </div>
  )
}
