// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'
import { SOROBAN_RPC_URLS } from '../lib/networkUrls.mjs'

function connectSrc(): string {
  const res = middleware(new NextRequest('https://dashboard.example/contracts'))
  const policy = res.headers.get('Content-Security-Policy') ?? ''
  return (
    policy
      .split(';')
      .find((directive) => directive.trim().startsWith('connect-src')) ?? ''
  )
}

function directive(name: string): string {
  const res = middleware(new NextRequest('https://dashboard.example/contracts'))
  const policy = res.headers.get('Content-Security-Policy') ?? ''
  return (
    policy.split(';').find((entry) => entry.trim().startsWith(`${name} `)) ?? ''
  )
}

describe('middleware Content-Security-Policy', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('allows the default RPC and Horizon endpoints of every network', () => {
    const directive = connectSrc()
    expect(directive).toContain(new URL(SOROBAN_RPC_URLS.mainnet).origin)
    expect(directive).toContain('https://soroban-testnet.stellar.org')
    expect(directive).toContain('https://rpc-futurenet.stellar.org')
    expect(directive).toContain('https://horizon.stellar.org')
    expect(directive).toContain('https://horizon-testnet.stellar.org')
    expect(directive).not.toContain('validationcloud')
  })

  it('allows per-network overrides, preserving scheme and port', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_SOROBAN_RPC_URL_MAINNET',
      'https://mainnet.stellar.validationcloud.io/v1/KEY/soroban/rpc'
    )
    vi.stubEnv(
      'NEXT_PUBLIC_SOROBAN_RPC_URL_TESTNET',
      'http://localhost:8000/rpc'
    )
    const directive = connectSrc()
    expect(directive).toContain('https://mainnet.stellar.validationcloud.io')
    expect(directive).toContain('http://localhost:8000')
    expect(directive).not.toContain('https://localhost')
  })

  it('locks down base-uri, object-src, form-action and frame-ancestors', () => {
    expect(directive('base-uri').trim()).toBe("base-uri 'self'")
    expect(directive('object-src').trim()).toBe("object-src 'none'")
    expect(directive('form-action').trim()).toBe("form-action 'self'")
    expect(directive('frame-ancestors').trim()).toBe("frame-ancestors 'none'")
  })

  it('omits API origin when NEXT_PUBLIC_API_URL is unset or blank', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '')
    const directiveVal = connectSrc()
    expect(directiveVal).not.toContain('api.example.com')
    expect(directiveVal).not.toContain('example.com')

    const defaultDirective = directive('default-src')
    expect(defaultDirective).not.toContain('api.example.com')
    expect(defaultDirective).not.toContain('example.com')

    const scriptDirective = directive('script-src')
    expect(scriptDirective).not.toContain('api.example.com')
    expect(scriptDirective).not.toContain('example.com')
  })

  it('includes configured API origin when NEXT_PUBLIC_API_URL is set', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.custombackend.com/v1')
    const directiveVal = connectSrc()
    expect(directiveVal).toContain('https://api.custombackend.com')
  })
})
