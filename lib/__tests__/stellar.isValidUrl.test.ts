import { describe, it, expect } from 'vitest'
import { isValidUrl, validateWebhookUrl } from '../stellar'

describe('isValidUrl', () => {
  it('accepts a valid http URL', () => {
    expect(isValidUrl('http://example.com')).toBe(true)
  })

  it('accepts a valid https URL', () => {
    expect(isValidUrl('https://example.com/webhook')).toBe(true)
  })

  it('rejects an ftp URL', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false)
  })

  it('rejects a ws URL', () => {
    expect(isValidUrl('ws://example.com')).toBe(false)
  })

  it('rejects a plain string with no protocol', () => {
    expect(isValidUrl('example.com')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidUrl('')).toBe(false)
  })

  it('rejects a malformed URL', () => {
    expect(isValidUrl('not a url at all')).toBe(false)
  })

  it('rejects a URL with only a protocol', () => {
    expect(isValidUrl('https://')).toBe(false)
  })

  it('accepts a URL with trimmed whitespace when pre-trimmed', () => {
    expect(isValidUrl('https://example.com')).toBe(true)
  })

  it('accepts a URL with surrounding whitespace (URL constructor trims automatically)', () => {
    // The URL constructor strips surrounding whitespace, so these are treated as valid
    expect(isValidUrl('  https://example.com  ')).toBe(true)
  })
})

// #117: Webhook URL validation tests
describe('validateWebhookUrl', () => {
  it('accepts a valid https URL', () => {
    expect(validateWebhookUrl('https://api.example.com/webhook', 'mainnet')).toBe(null)
  })

  it('rejects URLs with embedded credentials', () => {
    expect(validateWebhookUrl('https://user:pass@example.com/webhook', 'mainnet')).toBe('credentials_in_url')
  })

  it('blocks plain http on mainnet', () => {
    expect(validateWebhookUrl('http://example.com/webhook', 'mainnet')).toBe('http_on_mainnet')
  })

  it('warns on plain http for testnet', () => {
    expect(validateWebhookUrl('http://example.com/webhook', 'testnet')).toBe('http_warning')
  })

  it('rejects localhost addresses', () => {
    expect(validateWebhookUrl('http://localhost:8000/webhook', 'testnet')).toBe('loopback_not_allowed')
  })

  it('rejects 127.0.0.1', () => {
    expect(validateWebhookUrl('http://127.0.0.1:8000/webhook', 'testnet')).toBe('loopback_not_allowed')
  })

  it('rejects private IP range 10.x.x.x', () => {
    expect(validateWebhookUrl('http://10.0.0.1/webhook', 'testnet')).toBe('private_ip_not_allowed')
  })

  it('rejects private IP range 192.168.x.x', () => {
    expect(validateWebhookUrl('http://192.168.1.1/webhook', 'testnet')).toBe('private_ip_not_allowed')
  })

  it('rejects link-local 169.254.x.x', () => {
    expect(validateWebhookUrl('http://169.254.1.1/webhook', 'testnet')).toBe('link_local_not_allowed')
  })

  it('rejects invalid URLs', () => {
    expect(validateWebhookUrl('not a url', 'mainnet')).toBe('invalid_url')
  })
})
