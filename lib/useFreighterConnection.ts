'use client'

import { useEffect, useState } from 'react'
import { subscribeWallet } from '@/lib/walletEvents'
import { useState, useEffect } from 'react'
import { readFreighterConnection } from '@/lib/freighter'

export function useFreighterConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [network, setNetwork] = useState<string | null>(null)
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
