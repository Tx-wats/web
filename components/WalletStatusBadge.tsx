'use client'

import { useState, useEffect } from 'react'
import { readFreighterConnection } from '@/lib/freighter'

export type WalletStatus = 'checking' | 'connected' | 'disconnected' | 'unavailable'
/**
 * `checking` is the initial state: the extension's answer is unknown until
 * `isConnected()` settles, and showing "Unavailable" first made the badge
 * flash grey on every navigation.
 */
type WalletStatus = 'checking' | 'connected' | 'disconnected' | 'unavailable'

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
    let active = true

    async function check() {
      try {
        if (!window.freighter) {
          if (active) setStatus('unavailable')
          return
        }
        const connected = await window.freighter.isConnected()
        if (active) setStatus(connected ? 'connected' : 'disconnected')
      } catch {
        // A rejected isConnected() (extension mid-reload, locked wallet,
        // missing permissions) is not an error the user can act on: report
        // "Disconnected" instead of leaving the badge stuck.
        if (active) setStatus('disconnected')
      }
    }

    void check()

    return () => {
      active = false
    }
  }, [])

  if (status === 'checking') {
    return (
      <div
        role="status"
        aria-label="Checking wallet status"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" />
        <span className="text-xs text-zinc-600">Checking…</span>
      </div>
    )
  }

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
