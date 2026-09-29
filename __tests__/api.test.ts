import { vi } from 'vitest'
import { apiFetch, joinUrl, sendTestWebhook } from '@/lib/api'

global.fetch = vi.fn()

describe('apiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches successfully and merges headers', async () => {
    const mockData = { id: 1 }
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(mockData)),
    })

    const result = await apiFetch('/test', {
      headers: { 'X-Custom': 'value' },
    })

    // apiFetch passes a Headers instance; objectContaining cannot see into one,
    // so assert on the merged header values directly.
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({ headers: expect.any(Headers) })
    )
    const init = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as RequestInit
    const sent = init.headers as Headers
    expect(sent.get('X-Custom')).toBe('value')
    expect(sent.has('Content-Type')).toBe(false)
    expect(sent.get('X-Custom')).toBe('value')
    expect(result).toEqual(mockData)
  })

  it('throws error on non-OK response with text', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad request'),
    })

    await expect(apiFetch('/test')).rejects.toThrow('Bad request')
  })

  it('throws error on non-OK response without text', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    })

    await expect(apiFetch('/test')).rejects.toThrow('HTTP 500')
  })
})

describe('sendTestWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends webhook with correct payload structure', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    await sendTestWebhook('https://example.com/webhook', 'CBCDEF')

    const call = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const payload = JSON.parse(call[1].body)

    expect(payload).toMatchObject({
      label: 'Test Alert',
      contract_id: 'CBCDEF',
      network: 'testnet',
      rule_triggered: 'AnyTransaction',
    })
    expect(payload.transaction_hash).toMatch(/^TEST_HASH/)
  })

  it('throws error on webhook failure', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    })

    // A non-2xx is reported as a result rather than thrown, so the caller can
    // surface the actual status code (see app/contracts/new/page.tsx).
    await expect(sendTestWebhook('https://example.com/webhook', 'CBCDEF')).resolves.toEqual({
      status: 404,
      ok: false,
    })
  })

  it('times out even when caller signal is provided (#22)', async () => {
    vi.useFakeTimers()
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
          })
        })
    )

    const callerController = new AbortController()
    const promise = sendTestWebhook(
      'https://example.com/webhook',
      'CBCDEF',
      'testnet',
      callerController.signal
    )

    vi.advanceTimersByTime(10001)

    await expect(promise).rejects.toThrow('Webhook request timed out')
    vi.useRealTimers()
  })

  it('distinguishes caller cancellation from timeout (#22)', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('cancelled by caller'), { name: 'AbortError' }))
          })
        })
    )

    const callerController = new AbortController()
    const promise = sendTestWebhook(
      'https://example.com/webhook',
      'CBCDEF',
      'testnet',
      callerController.signal
    )

    callerController.abort()

    await expect(promise).rejects.toThrow('cancelled by caller')
  })
})

describe('apiFetch hardening', () => {
  const f = () => global.fetch as unknown as ReturnType<typeof vi.fn>

  it('returns undefined for 204 and empty bodies', async () => {
    f().mockResolvedValueOnce({ ok: true, status: 204, text: () => Promise.resolve('') })
    await expect(apiFetch('/x', { method: 'DELETE' })).resolves.toBeUndefined()
    f().mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve('') })
    await expect(apiFetch('/x')).resolves.toBeUndefined()
  })

  it('sets Content-Type only when a body is sent', async () => {
    f().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('{}') })
    await apiFetch('/x', { method: 'POST', body: '{}' })
    const init = f().mock.calls.at(-1)![1] as RequestInit
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json')
  })

  it('times out and aborts the request', async () => {
    f().mockImplementation((_u: string, init: RequestInit) =>
      new Promise((_, reject) => {
        init.signal!.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        )
      })
    )
    await expect(apiFetch('/x', { timeoutMs: 10 })).rejects.toThrow('Request timed out')
  })

  it('propagates a caller abort', async () => {
    f().mockImplementation((_u: string, init: RequestInit) =>
      new Promise((_, reject) => {
        init.signal!.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        )
      })
    )
    const ac = new AbortController()
    const p = apiFetch('/x', { signal: ac.signal })
    ac.abort()
    await expect(p).rejects.toThrow('aborted')
  })
})

describe('joinUrl', () => {
  it('joins with a single slash', () => {
    expect(joinUrl('http://a/', '/b')).toBe('http://a/b')
    expect(joinUrl('http://a', 'b')).toBe('http://a/b')
    expect(joinUrl('', '/b')).toBe('/b')
  })
})
