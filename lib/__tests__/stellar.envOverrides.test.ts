import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HORIZON_URLS,
  SOROBAN_RPC_URLS,
  getMainnetSorobanRpcWarning,
  horizonUrl,
  isMainnetSorobanRpcConfigured,
  sorobanRpcUrl,
} from '@/lib/stellar'

describe('network URL overrides', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('falls back to defaults including keyless public mainnet Soroban RPC (#269)', () => {
    expect(horizonUrl('testnet')).toBe(HORIZON_URLS.testnet)
    expect(SOROBAN_RPC_URLS.mainnet).toBe('https://mainnet.sorobanrpc.com')
    expect(sorobanRpcUrl('mainnet')).toBe(SOROBAN_RPC_URLS.mainnet)
    expect(isMainnetSorobanRpcConfigured()).toBe(false)
    expect(getMainnetSorobanRpcWarning()).toContain('NEXT_PUBLIC_SOROBAN_RPC_URL_MAINNET')
  })

  it('clears the mainnet Soroban RPC warning when NEXT_PUBLIC_SOROBAN_RPC_URL_MAINNET is set (#269)', () => {
    vi.stubEnv('NEXT_PUBLIC_SOROBAN_RPC_URL_MAINNET', 'https://rpc.example.com')
    expect(isMainnetSorobanRpcConfigured()).toBe(true)
    expect(getMainnetSorobanRpcWarning()).toBeNull()
  })

  it('uses the global override and trims trailing slashes', () => {
    vi.stubEnv('NEXT_PUBLIC_HORIZON_URL', 'https://h.example/')
    expect(horizonUrl('futurenet')).toBe('https://h.example')
  })

  it('prefers per-network over global', () => {
    vi.stubEnv('NEXT_PUBLIC_SOROBAN_RPC_URL', 'https://global.example')
    vi.stubEnv('NEXT_PUBLIC_SOROBAN_RPC_URL_MAINNET', 'https://main.example')
    expect(sorobanRpcUrl('mainnet')).toBe('https://main.example')
    expect(sorobanRpcUrl('testnet')).toBe('https://global.example')
  })

  it('ignores blank values', () => {
    vi.stubEnv('NEXT_PUBLIC_HORIZON_URL', '  ')
    expect(horizonUrl('mainnet')).toBe(HORIZON_URLS.mainnet)
  })
})
