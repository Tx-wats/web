'use client'

import { useEffect, useState } from 'react'
import { useWalletState } from '@/hooks/useWalletState'
import { useState, useEffect, useCallback } from 'react'

const WALLET_STORAGE_KEY = 'freighter_public_key'
import { useState, useEffect } from 'react'
import {
  connectFreighter,
  FreighterUnavailableError,
  openFreighterInstallPage,
  readFreighterConnection,
} from '@/lib/freighter'

interface FreighterConnectProps {
  className?: string
  onConnect?: (publicKey: string) => void
  /** Fired when the user disconnects from this page. */
  onDisconnect?: () => void
}

export default function FreighterConnect({ onConnect, className = '' }: FreighterConnectProps) {
  const { publicKey, initialized, publish } = useWalletState()
export default function FreighterConnect({
  onConnect,
  onDisconnect,
  className = '',
}: FreighterConnectProps) {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [network, setNetwork] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missingExtension, setMissingExtension] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // Fired off the shared state rather than off the click handler, so a
  // connection made through any other button still notifies the parent.
  useEffect(() => {
    if (publicKey) onConnect?.(publicKey)
  const checkConnection = useCallback(async () => {
    try {
      if (!window.freighter) {
        return
      }

      const connected = await window.freighter.isConnected()
      if (connected) {
        const [key, net] = await Promise.all([
          window.freighter.getPublicKey(),
          window.freighter.getNetwork ? window.freighter.getNetwork() : Promise.resolve(null),
        ])
        setPublicKey(key)
        setNetwork(net)
        window.__freighterPublicKey = key
        onConnect?.(key)
        setMissingExtension(false)
      } else {
        setPublicKey(null)
        setNetwork(null)
      const connection = await readFreighterConnection()
      if (connection?.publicKey) {
        setPublicKey(connection.publicKey)
        onConnect?.(connection.publicKey)
      }
    } catch {
      // Connection check failed
    } finally {
      setIsInitializing(false)
    }
  }, [onConnect])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  // Periodic polling & focus listener to detect account / network changes (#9)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    const handleSync = async () => {
      if (document.hidden || !window.freighter) return
      try {
        const connected = await window.freighter.isConnected()
        if (connected) {
          const [key, net] = await Promise.all([
            window.freighter.getPublicKey(),
            window.freighter.getNetwork ? window.freighter.getNetwork() : Promise.resolve(null),
          ])
          setPublicKey((prev) => {
            if (prev !== key) {
              window.__freighterPublicKey = key
              onConnect?.(key)
            }
            return key
          })
          setNetwork(net)
          setMissingExtension(false)
        } else if (publicKey) {
          setPublicKey(null)
          setNetwork(null)
        }
      } catch {
        // Ignore background polling errors
      }
    }

    const onVisibilityChange = () => {
      if (!document.hidden) {
        handleSync()
      }
    }

    const onFocus = () => {
      handleSync()
    }

    intervalId = setInterval(handleSync, 5000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)

    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [publicKey, onConnect])

  async function connect() {
    if (isConnecting) return
    setIsConnecting(true)
    setLoading(true)
    setError(null)

    try {
      if (!window.freighter) {
        setMissingExtension(true)
        setError('Freighter not installed - install the extension and reload')
        return
      }

      setMissingExtension(false)
      const key = await window.freighter.getPublicKey()
      const net = window.freighter.getNetwork ? await window.freighter.getNetwork() : null

      if (!key) {
        setError('Failed to retrieve wallet information')
        return
      }

      publish(key)
      setPublicKey(key)
      setNetwork(net)
      window.__freighterPublicKey = key
      localStorage.setItem(WALLET_STORAGE_KEY, key)
      onConnect?.(key)
      const session = await connectFreighter()
      setPublicKey(session.publicKey)
      onConnect?.(session.publicKey)
    } catch (err) {
      if (err instanceof FreighterUnavailableError) {
        openFreighterInstallPage()
      }
      setError(err instanceof Error ? err.message : 'Connection rejected')
    } finally {
      setLoading(false)
      setIsConnecting(false)
    }
  }

  // The extension stays authorised after this — this only clears the local view
  // of the session. Nothing is persisted: the wallet is the source of truth, so
  // a key cached in localStorage would outlive an account switch in Freighter.
  function disconnect() {
    publish(null)
    setPublicKey(null)
    setNetwork(null)
    localStorage.removeItem(WALLET_STORAGE_KEY)
    onDisconnect?.()
  }

  const handleInstallClick = () => {
    const onFocusBack = () => {
      window.removeEventListener('focus', onFocusBack)
      checkConnection()
    }
    window.addEventListener('focus', onFocusBack)
  }

  if (!initialized) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-24 h-9 rounded-lg bg-zinc-800 animate-pulse" />
      </div>
    )
  }

  if (publicKey) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
        <span className="text-sm text-zinc-300 font-mono">
          {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
        </span>
        {network && (
          <span
            data-testid="wallet-network-pill"
            className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700"
          >
            {network}
          </span>
        )}
        <button
          onClick={disconnect}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <button
        onClick={connect}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        )}
        Connect Freighter
      </button>

      {missingExtension ? (
        <div className="mt-2 flex flex-col gap-1.5 text-xs text-zinc-400" role="alert">
          <p>
            Freighter not installed —{' '}
            <a
              href="https://www.freighter.app/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleInstallClick}
              className="text-indigo-400 underline hover:text-indigo-300"
            >
              Install Freighter
            </a>
          </p>
          <button
            type="button"
            onClick={async () => {
              setError(null)
              if (window.freighter) {
                setMissingExtension(false)
                await connect()
              } else {
                setError('Freighter extension still not detected')
              }
            }}
            className="inline-flex items-center px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 border border-zinc-700 transition-colors self-start"
          >
            I&apos;ve installed it – check again
          </button>
        </div>
      ) : error ? (
        <p className="mt-2 text-xs text-red-400" role="alert">{error}</p>
      ) : null}
    </div>
  )
}
