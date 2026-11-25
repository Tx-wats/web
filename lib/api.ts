import { validateContractEntry } from "./validation";
import type { WatchedContract } from "./types";
import { horizonUrl, isValidContractId } from '@/lib/stellar'
import { SIGNATURE_HEADER, signWebhookPayload } from './webhookSignature'
import { formatThresholdXlm } from './format'
import { selectTestDeliveryHeaders } from './webhookHeaders'
import { formatWebhookBody } from './webhookFormat'
import { sanitizeBodySnippet } from './bodySnippet'
import { getAuthorizationHeader, notifyAuthRequired } from './apiAuth'
import type {
  AlertPayload,
  AlertRule,
  Network,
  WebhookFormat,
} from '@/types'
import { isValidFunctionName } from '@/lib/soroban'
import { largeTransferAssetLabel } from '@/types'
import type { AlertPayload, AlertRule, Network } from '@/types'

// ... existing imports and code above remain unchanged ...

export async function pushContract(
  contract: WatchedContract,
  syncStatus: Record<string, SyncStatus>,
): Promise<void> {
  const isNew = !contract.id;

  const serverRecord = isNew
    ? await createContract(contract)
    : await updateContract(contract);

  const validated = validateContractEntry(serverRecord);
  if (!validated) {
    return;
/**
 * Whether the app is running in API mode, i.e. a backend API URL is
 * configured. Single source of truth for API-mode detection.
 */
export function isApiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_URL)
}

/** Default request timeout for apiFetch, in milliseconds. */
export const API_TIMEOUT_MS = 15000

/** Join a base URL and a path with exactly one slash between them. */
export function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (!base) return path
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/** Non-2xx response from apiFetch, carrying the status and any Retry-After hint. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Parsed Retry-After header in milliseconds, when present. */
    readonly retryAfterMs?: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Parse a Retry-After header (delta-seconds or HTTP-date) into milliseconds. */
export function parseRetryAfter(
  value: string | null,
  now = Date.now()
): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (value.trim() !== '' && Number.isFinite(seconds))
    return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}

/**
 * Extract a human-readable message from a parsed error body. Handles plain
 * `message`/`error` strings, nested `error.message`, `errors[0].message`, and
 * RFC 7807 `detail`. Returns `undefined` when no string message is found.
 */
export function extractErrorMessage(body: unknown): string | undefined {
  if (typeof body === 'string') return body || undefined
  if (!body || typeof body !== 'object') return undefined
  const obj = body as Record<string, unknown>
  if (typeof obj.message === 'string' && obj.message) return obj.message
  if (typeof obj.error === 'string' && obj.error) return obj.error
  if (obj.error && typeof obj.error === 'object') {
    const nested = (obj.error as Record<string, unknown>).message
    if (typeof nested === 'string' && nested) return nested
  }
  if (Array.isArray(obj.errors)) {
    const first = obj.errors[0]
    if (first && typeof first === 'object') {
      const nested = (first as Record<string, unknown>).message
      if (typeof nested === 'string' && nested) return nested
    } else if (typeof first === 'string' && first) {
      return first
    }
  }
  if (typeof obj.detail === 'string' && obj.detail) return obj.detail
  return undefined
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
  // Credentials go only to the core (relative paths), never to absolute URLs.
  if (!/^https?:\/\//i.test(path) && !headers.has('authorization')) {
    const authorization = await getAuthorizationHeader()
    if (authorization) headers.set('Authorization', authorization)
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
          message = extractErrorMessage(body) ?? text
        } catch {
          message = text
        }
      }
      if (res.status === 401) notifyAuthRequired()
      throw new ApiError(
        message,
        res.status,
        parseRetryAfter(res.headers?.get('retry-after') ?? null)
      )
    }

    if (res.status === 204) return undefined as T
    const contentType = res.headers?.get('content-type') ?? ''
    if (!/\bapplication\/(?:[\w.+-]*\+)?json\b/i.test(contentType)) {
      throw new ApiError('API returned non-JSON response', res.status)
    }
    const text = await res.text()
    if (!text) return undefined as T
    return JSON.parse(text) as T
  } catch (error) {
    if (
      (error as { name?: string })?.name === 'AbortError' &&
      !init.signal?.aborted
    ) {
      throw new Error('Request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    init.signal?.removeEventListener('abort', onCallerAbort)
  }
}

/**
 * Cheap authenticated endpoint used by the Settings "Test connection" action
 * to validate the currently stored API key. Resolves on success and throws an
 * `ApiError` (e.g. 401) when the key is missing or rejected.
 */
export async function testApiConnection(): Promise<void> {
  await apiFetch<unknown>('/auth/me', { timeoutMs: 8000 })
}

/** Result of a test webhook delivery: the HTTP status and whether it succeeded. */
export interface TestWebhookResult {
  /** The receiver's HTTP status (not the proxy's). */
  status: number
  ok: boolean
  /** Round-trip time to the receiver, in milliseconds. */
  durationMs?: number
  /** Sanitised first bytes (max 1 KB) of a text response body. */
  bodySnippet?: string | null
  /** Why the delivery could not be made (e.g. blocked URL, timeout). */
  error?: string
  /**
   * Where a 3xx receiver redirects to (origin and path only). Redirects are
   * never followed, so this tells the user which URL to configure instead.
   */
  location?: string
}

/**
 * Syntactically valid but non-existent transaction hash (64 lowercase hex
 * chars) used for simulated alerts, so receivers that parse the hash do not
 * reject the payload before they can branch on the rule.
 */
export const TEST_TX_HASH = 'ab'.repeat(32)

/** Valid placeholder contract (all-zero hash) for tests sent before a contract ID is entered. */
export const TEST_CONTRACT_ID =
  'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4'

/** Human-readable label for a rule, used in the test-payload rule picker. */
export function describeRule(rule: AlertRule): string {
  switch (rule.type) {
    case 'LargeTransfer':
      return `${rule.type} (over ${formatThresholdXlm(rule.threshold_xlm)} XLM)`
      return `${rule.type} (over ${rule.threshold_xlm} ${largeTransferAssetLabel(rule)})`
    case 'FunctionCalled':
      return `${rule.type} (${rule.function_name.trim()})`
    case 'AdminFunctionCalled':
      return `${rule.type} (${rule.function_names.join(', ')})`
    default:
      return rule.type
  }
}

export interface BuildTestWebhookPayloadOptions {
  contractId: string
  network?: Network
  /** Configured rule to simulate. Defaults to `AnyTransaction`. */
  rule?: AlertRule
  /**
   * For `AdminFunctionCalled`, which of the rule's function names to simulate.
   * Ignored unless it is one of `function_names`; defaults to the first.
   */
  functionName?: string
  label?: string
  /** Overridable for deterministic previews/tests; defaults to now. */
  timestamp?: number
  /** Overridable for deterministic previews/tests; defaults to `TEST_TX_HASH`. */
  transactionHash?: string
}

/**
 * Builds the JSON body sent to a webhook receiver for a test delivery.
 *
 * The payload mirrors a real alert for the simulated rule: `rule_triggered`
 * follows the rule, rule-specific fields (`function_name`, `amount`) are
 * filled in from its configuration, and `horizon_link` points at the network's
 * Horizon with the same hash carried in `transaction_hash`, so a receiver can
 * parse the link. `is_test: true` marks the delivery as simulated.
 */
export function buildTestWebhookPayload({
  contractId,
  network = 'testnet',
  rule,
  functionName,
  label = 'Test Alert',
  timestamp = Date.now(),
  transactionHash = TEST_TX_HASH,
}: BuildTestWebhookPayloadOptions): AlertPayload {
  const triggered = rule?.type ?? 'AnyTransaction'
  const payload: AlertPayload = {
    contract_id: contractId,
    transaction_hash: transactionHash,
    event_type: triggered,
    rule_triggered: triggered,
    timestamp,
    horizon_link: `${horizonUrl(network)}/transactions/${transactionHash}`,
    is_test: true,
    label,
  }
  if (rule?.type === 'LargeTransfer') {
    payload.amount = rule.threshold_xlm
  } else if (rule?.type === 'FunctionCalled') {
    payload.function_name = rule.function_name.trim()
  } else if (rule?.type === 'AdminFunctionCalled') {
    payload.function_name = rule.function_names[0]?.trim()

  // Rule-specific fields match the variant tx-watch-core emits for that rule.
  switch (rule?.type) {
    case 'LargeTransfer':
      payload.amount = rule.threshold_xlm
      break
    case 'FunctionCalled':
      payload.function_name = rule.function_name.trim()
      break
    case 'AdminFunctionCalled':
      payload.function_name = (
        functionName !== undefined && rule.function_names.includes(functionName)
          ? functionName
          : rule.function_names[0]
      )?.trim()
      break
    default:
      break
  }
  return payload
}

/**
 * Minimal shape of a queued sync retry. The runner only needs the scheduled
 * attempt time to decide when to wake up; the actual retry execution is
 * handled elsewhere.
 */
export interface SyncRetryEntry {
  nextAttemptAt: number
export function ruleFromPayload(payload: AlertPayload): AlertRule | undefined {
  switch (payload.rule_triggered) {
    case 'LargeTransfer':
      return { type: 'LargeTransfer', threshold_xlm: payload.amount ?? 0 }
    case 'FunctionCalled':
      return {
        type: 'FunctionCalled',
        function_name: payload.function_name ?? '',
      }
    case 'AdminFunctionCalled':
      // Allow-list: only a syntactically valid function name is accepted (#447)
      if (!isValidFunctionName(payload.function_name ?? '')) return undefined
      return {
        type: 'AdminFunctionCalled',
        function_names: [payload.function_name ?? ''],
      }
    case 'AnyTransaction':
    case 'TransactionFailed':
      return { type: payload.rule_triggered }
    default:
      return undefined
  }

  const localKey = contract.id ?? contract.localId;
  const serverKey = validated.id ?? localKey;

  if (serverKey !== localKey) {
    delete cache[localKey];
    cache[serverKey] = validated;

    const status = syncStatus[localKey];
    if (status) {
      delete syncStatus[localKey];
      syncStatus[serverKey] = status;
    }
  } else {
    cache[serverKey] = validated;
/** localStorage key holding the pending sync-retry queue. */
export const SYNC_RETRY_QUEUE_KEY = 'sync-retry-queue'

/** Read the pending sync-retry queue from localStorage, tolerating bad data. */
export function readSyncRetryQueue(): SyncRetryEntry[] {
  if (typeof window === 'undefined') return []
/**
 * How far a test payload's `timestamp` (ms) may be from server time before
 * the proxy refuses to forward it (#401): 5 minutes, the same window
 * receivers apply to the signature's `t=`.
 */
export const TEST_PAYLOAD_MAX_SKEW_MS = 5 * 60 * 1000

export interface ParseCanonicalTestPayloadOptions {
  /** Current time in ms; injectable for tests. Defaults to Date.now(). */
  now?: number
  /** Allowed distance from `now`, in ms. Defaults to 5 minutes. */
  maxSkewMs?: number
}

/**
 * Parses a caller-supplied test payload body and returns it only if it is
 * exactly what buildTestWebhookPayload would produce for its own contract,
 * network, rule, label, timestamp and transaction hash. The proxy uses this
 * so it forwards dashboard-built test payloads verbatim (keeping the
 * browser's signature valid) without becoming a relay for arbitrary
 * content (#261). Payloads dated more than `maxSkewMs` before or after `now`
 * are refused too, so a captured body cannot be replayed through the proxy
 * indefinitely (#401). Returns null for anything else.
 */
export function parseCanonicalTestPayload(
  body: string,
  format: WebhookFormat = 'json',
  sentPayload?: unknown
): AlertPayload | null {
  if (format !== 'json') {
    // Slack/Discord bodies hold only a summary, so the alert arrives as
    // `payload`. It must be canonical, and the formatted body must be exactly
    // what that alert renders to.
    const alert = parseCanonicalTestPayload(JSON.stringify(sentPayload ?? null))
    if (!alert) return null
    return formatWebhookBody(alert, format) === body ? alert : null
  }
  {
    now = Date.now(),
    maxSkewMs = TEST_PAYLOAD_MAX_SKEW_MS,
  }: ParseCanonicalTestPayloadOptions = {}
): AlertPayload | null {
  let p: Record<string, unknown>
  try {
    const raw = window.localStorage.getItem(SYNC_RETRY_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is SyncRetryEntry =>
        entry != null && typeof entry.nextAttemptAt === 'number'
    )
  } catch {
    return []
  }
}

/**
 * Starts the sync-retry runner. Returns a cleanup function that stops the
 * runner and removes all listeners/timers.
 *
 * Behaviour (issue #382):
 * - No-op when the API is not configured.
 * - Schedules a single timer for the earliest `nextAttemptAt` instead of
 *   polling on a fixed interval.
 * - Re-arms when the queue changes (storage events and a custom event).
 * - Pauses while the tab is hidden and resumes when it becomes visible.
 */
export function startSyncRetries(
  onRetry: (entry: SyncRetryEntry) => void = () => {}
): () => void {
  if (typeof window === 'undefined' || !isApiConfigured()) {
    return () => {}
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
  if (typeof p !== 'object' || p === null || Array.isArray(p)) return null
  if (p.is_test !== true) return null
  if (typeof p.contract_id !== 'string' || !isValidContractId(p.contract_id))
    return null
  if (!TEST_PAYLOAD_NETWORKS.includes(p.network as Network)) return null
  if (
    typeof p.label !== 'string' ||
    !p.label ||
    p.label.length > MAX_TEST_LABEL_LENGTH
  )
    return null
  if (typeof p.timestamp !== 'number' || !Number.isFinite(p.timestamp))
    return null
  if (Math.abs(now - p.timestamp) > maxSkewMs) return null
  if (
    typeof p.transaction_hash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(p.transaction_hash)
  )
    return null
  if (typeof p.rule_triggered !== 'string') return null

  const payload = p as unknown as AlertPayload
  const rule = ruleFromPayload(payload)
  if (!rule) return null
  const rebuilt = buildTestWebhookPayload({
    contractId: payload.contract_id,
    network: payload.network as Network,
    rule,
    label: payload.label,
    timestamp: payload.timestamp,
    transactionHash: payload.transaction_hash,
  })
  return canonicalJson(rebuilt) === canonicalJson(payload) ? payload : null
}

interface SendTestWebhookTransport {
  /** Caller-owned signal, or a timeout in milliseconds (default 10000). */
  signalOrTimeoutMs?: AbortSignal | number
  /**
   * Signing secret for the delivery. When provided (e.g. the stored
   * `webhook_secret` of a watched contract), the request body is signed with
   * HMAC-SHA256 (timestamped, `t=…,v1=…`) and sent in the `SIGNATURE_HEADER` header.
   */
  secret?: string
  /** Body shape for the receiver. Absent = `json`. */
  format?: WebhookFormat
  /**
   * Custom headers from the watched contract. Only names on the test-delivery
   * allow-list are sent; the rest are dropped (see lib/webhookHeaders).
   */
  headers?: Record<string, string>
}

export type SendTestWebhookOptions = SendTestWebhookTransport &
  /** Send a pre-built payload verbatim, e.g. the one shown in a preview. */
  (
    | { payload: AlertPayload }
    | ({ payload?: undefined } & BuildTestWebhookPayloadOptions)
  )

export async function sendTestWebhook(
  webhookUrl: string,
  options: SendTestWebhookOptions
): Promise<TestWebhookResult> {
  const { signalOrTimeoutMs = 10000, secret, format = 'json' } = options
  const deliveryHeaders = selectTestDeliveryHeaders(options.headers)
  const payload =
    'payload' in options && options.payload
      ? options.payload
      : buildTestWebhookPayload(options)

  const externalSignal =
    typeof signalOrTimeoutMs === 'number' ? undefined : signalOrTimeoutMs
  const timeoutMs =
    typeof signalOrTimeoutMs === 'number' ? signalOrTimeoutMs : 10000

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
      combinedController.abort(
        externalSignal?.reason || new Error('cancelled by caller')
      )
    }
  }

  const runDue = () => {
    timer = null
    if (stopped || document.hidden) return
    const now = Date.now()
    const queue = readSyncRetryQueue()
    for (const entry of queue) {
      if (entry.nextAttemptAt <= now) onRetry(entry)
    }
    arm()
  }

  const arm = () => {
    clearTimer()
    if (stopped || document.hidden) return
    const queue = readSyncRetryQueue()
    if (queue.length === 0) return
    const earliest = queue.reduce(
      (min, entry) => Math.min(min, entry.nextAttemptAt),
      Number.POSITIVE_INFINITY
    )
    const delay = Math.max(0, earliest - Date.now())
    timer = setTimeout(runDue, delay)
  }

  const onVisibilityChange = () => {
    if (document.hidden) clearTimer()
    else arm()
  }

  const onQueueChange = () => arm()
  try {
    const body =
      format === 'json'
        ? JSON.stringify(payload)
        : formatWebhookBody(payload, format)
    const headers: Record<string, string> = {
      ...deliveryHeaders,
      'Content-Type': 'application/json',
    }
    if (secret)
      headers[SIGNATURE_HEADER] = await signWebhookPayload(secret, body)

    // In browser production, route through server proxy to avoid CORS failures (#23)
    const isBrowser = typeof window !== 'undefined'
    const useProxy = isBrowser && process.env.NODE_ENV !== 'test'

    if (useProxy) {
      // The body is signed here in the browser; only the signature crosses
      // the network, never the secret, so it cannot end up in server logs,
      // APM traces or error reports. The proxy forwards both verbatim.
      const proxyRes = await fetch('/api/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          body,
          ...(headers[SIGNATURE_HEADER]
            ? { signature: headers[SIGNATURE_HEADER] }
            : {}),
          ...(format !== 'json' ? { format, payload } : {}),
          ...(Object.keys(deliveryHeaders).length > 0
            ? { headers: deliveryHeaders }
            : {}),
        }),
        signal,
      })
      // The proxy answers with the receiver's status, timing and body snippet
      // as JSON; its own HTTP status is not the receiver's.
      const data = (await proxyRes.json().catch(() => ({}))) as {
        status?: number
        ok?: boolean
        durationMs?: number
        bodySnippet?: string | null
        error?: string
        location?: unknown
      }
      return {
        status: typeof data.status === 'number' ? data.status : proxyRes.status,
        ok: data.ok === true,
        durationMs: data.durationMs,
        bodySnippet: data.bodySnippet ?? null,
        ...(data.error ? { error: data.error } : {}),
        ...(typeof data.location === 'string' && data.location
          ? { location: data.location }
          : {}),
      }
    }

  window.addEventListener('storage', onQueueChange)
  window.addEventListener('sync-retry-queue-changed', onQueueChange)
  document.addEventListener('visibilitychange', onVisibilityChange)

  arm()

  return () => {
    stopped = true
    clearTimer()
    window.removeEventListener('storage', onQueueChange)
    window.removeEventListener('sync-retry-queue-changed', onQueueChange)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    // The status is reported back rather than thrown on, so callers can show
    // the actual code; a non-2xx is still a failed delivery.
    return { status: res.status, ok: res.ok, durationMs, bodySnippet }
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
