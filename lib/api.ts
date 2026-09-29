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

import type { AlertRule, AlertRuleType, Network } from '@/types'

/** Result of a test webhook delivery: the HTTP status and whether it succeeded. */
export interface TestWebhookResult {
  status: number
  ok: boolean
  durationMs?: number
}

export interface TestWebhookPayloadOptions {
  rule?: AlertRule | AlertRuleType | string
  function_name?: string
  amount?: string | number
  transaction_hash?: string
  is_test?: boolean
}

/**
 * Builds a dynamic, rule-aware test webhook payload (#24).
 * Replaces hardcoded values with realistic 64-hex dummy hashes,
 * valid Horizon explorer links, and rule-matching attributes.
 */
export function buildTestWebhookPayload(
  contractId: string,
  network: Network = 'testnet',
  options?: TestWebhookPayloadOptions
) {
  const dummyHash =
    options?.transaction_hash ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

  let ruleType = 'AnyTransaction'
  let functionName: string | undefined = options?.function_name
  let amount: string | number | undefined = options?.amount

  if (typeof options?.rule === 'string') {
    ruleType = options.rule
  } else if (options?.rule && typeof options.rule === 'object') {
    ruleType = options.rule.rule_type
    if (options.rule.rule_type === 'FunctionCalled') {
      functionName = options.rule.function_name || functionName || 'transfer'
    } else if (options.rule.rule_type === 'LargeTransfer') {
      amount = options.rule.min_amount || amount || '1000'
    }
  }

  const payload: Record<string, any> = {
    label: 'Test Alert',
    contract_id: contractId,
    network,
    rule_triggered: ruleType,
    transaction_hash: dummyHash,
    timestamp: Date.now(),
    horizon_link: `${horizonUrl(network)}/transactions/${dummyHash}`,
    is_test: true,
  }

  if (functionName) {
    payload.function_name = functionName
  }
  if (amount !== undefined) {
    payload.amount = amount
  }

  return payload
}

export async function sendTestWebhook(
  webhookUrl: string,
  contractId: string,
  network: Network = 'testnet',
  signalOrTimeoutMs: AbortSignal | number = 10000,
  secret?: string,
  options?: TestWebhookPayloadOptions
): Promise<TestWebhookResult> {
  const payload = buildTestWebhookPayload(contractId, network, options)

  // Callers either hand us their own AbortSignal or rely on the default timeout.
  const external = typeof signalOrTimeoutMs === 'number' ? undefined : signalOrTimeoutMs
  const controller = new AbortController()
  const timeoutId =
    external === undefined
      ? setTimeout(() => controller.abort(), signalOrTimeoutMs as number)
      : undefined
  const signal = external ?? controller.signal

  try {
    const body = JSON.stringify(payload)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (secret) headers[SIGNATURE_HEADER] = await signWebhookPayload(secret, body)

    // In browser production, route through server proxy to avoid CORS failures (#23)
    const isBrowser = typeof window !== 'undefined'
    const useProxy = isBrowser && process.env.NODE_ENV !== 'test'

    let res: Response
    if (useProxy) {
      res = await fetch('/api/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, payload, secret }),
        signal,
      })
    } else {
      res = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body,
        signal,
      })
    }

    // The status is reported back rather than thrown on, so callers can show
    // the actual code; a non-2xx is still a failed delivery.
    return { status: res.status, ok: res.ok }
  } catch (error) {
    const err = error as { name?: string }
    if (err?.name === 'AbortError') {
      throw new Error('Webhook request timed out')
    }
    throw error
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}
