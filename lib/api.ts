import { horizonUrl } from '@/lib/stellar'
import { SIGNATURE_HEADER, signWebhookPayload } from './webhookSignature'
import { HORIZON_URLS } from '@/lib/stellar'
import type { Network } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

/** Default request timeout for apiFetch, in milliseconds. */
export const API_TIMEOUT_MS = 15000

/** Join a base URL and a path with exactly one slash between them. */
export function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (!base) return path
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs = API_TIMEOUT_MS, ...init } = options ?? {}
  const headers = new Headers(init.headers)
  if (init.body != null && !headers.has('content-type')) {
    headers.set('Content-Type', 'application/json')
  }

  // Combine the caller's signal (if any) with a timeout signal.
  const controller = new AbortController()
  const onCallerAbort = () => controller.abort()
  if (init.signal) {
    if (init.signal.aborted) controller.abort()
    else init.signal.addEventListener('abort', onCallerAbort, { once: true })
  }
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(joinUrl(BASE_URL, path), {
      ...init,
      headers,
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      let message = `HTTP ${res.status}`
      if (text) {
        try {
          const body = JSON.parse(text)
          message = body?.message || body?.error || text
        } catch {
          message = text
        }
      }
      throw new Error(message)
    }

    if (res.status === 204) return undefined as T
    const text = await res.text()
    if (!text) return undefined as T
    return JSON.parse(text) as T
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError' && !init.signal?.aborted) {
      throw new Error('Request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    init.signal?.removeEventListener('abort', onCallerAbort)
  }
}

/** Result of a test webhook delivery: the HTTP status and whether it succeeded. */
export interface TestWebhookResult {
  status: number
  ok: boolean
}

export async function sendTestWebhook(
  webhookUrl: string,
  contractId: string,
  network: Network = 'testnet',
  signalOrTimeoutMs: AbortSignal | number = 10000,
  secret?: string
): Promise<TestWebhookResult> {
  const payload = {
    label: 'Test Alert',
    contract_id: contractId,
    network,
    rule_triggered: 'AnyTransaction',
    transaction_hash:
      'TEST_HASH_0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: Date.now(),
    horizon_link: `${horizonUrl(network)}/transactions/test`,
  }

  const externalSignal = typeof signalOrTimeoutMs === 'number' ? undefined : signalOrTimeoutMs
  const timeoutMs = typeof signalOrTimeoutMs === 'number' ? signalOrTimeoutMs : 10000

  const internalController = new AbortController()
  let timedOut = false

  const timeoutId = setTimeout(() => {
    timedOut = true
    internalController.abort(new Error('timed out'))
  }, timeoutMs)

  const combinedController = new AbortController()

  const onCallerAbort = () => {
    clearTimeout(timeoutId)
    if (!combinedController.signal.aborted) {
      combinedController.abort(externalSignal?.reason || new Error('cancelled by caller'))
    }
  }

  const onTimeoutAbort = () => {
    if (!combinedController.signal.aborted) {
      combinedController.abort(new Error('timed out'))
    }
  }

  if (externalSignal?.aborted) {
    clearTimeout(timeoutId)
    combinedController.abort(externalSignal.reason || new Error('cancelled by caller'))
  } else {
    externalSignal?.addEventListener('abort', onCallerAbort, { once: true })
    internalController.signal.addEventListener('abort', onTimeoutAbort, { once: true })
  }

  const signal = combinedController.signal

  try {
    const body = JSON.stringify(payload)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (secret) headers[SIGNATURE_HEADER] = await signWebhookPayload(secret, body)
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body,
      signal,
    })
    // The status is reported back rather than thrown on, so callers can show
    // the actual code; a non-2xx is still a failed delivery.
    return { status: res.status, ok: res.ok }
  } catch (error) {
    if (timedOut || internalController.signal.aborted) {
      throw new Error('Webhook request timed out')
    }
    if (externalSignal?.aborted) {
      throw new Error('Webhook request cancelled by caller')
    }
    const err = error as { name?: string; message?: string }
    if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
      throw new Error('Webhook request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', onCallerAbort)
    internalController.signal.removeEventListener('abort', onTimeoutAbort)
  }
}
