import { apiFetch } from '@/lib/api'
import type { WatchedContract } from '@/types'

/**
 * ASSUMED tx-watch-core REST routes (not verified against the core repo):
 *   GET    /contracts        -> WatchedContract[]
 *   POST   /contracts        -> WatchedContract   (body: WatchedContract)
 *   PUT    /contracts/:id    -> WatchedContract   (body: WatchedContract)
 *   DELETE /contracts/:id    -> 204 / empty body
 * Contract objects use the same shape as the local WatchedContract type.
 */

/** Soroban symbols are limited to 32 characters. */
export const SOROBAN_SYMBOL_MAX_LENGTH = 32

/**
 * Same validation used for FunctionCalled names: a Soroban symbol must be
 * non-empty, at most 32 characters, and contain only letters, digits, and
 * underscores (no leading digit, no dashes).
 */
export const FUNCTION_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/

export function isValidFunctionName(name: string): boolean {
  return FUNCTION_NAME_REGEX.test(name)
}

/**
 * Validate and de-duplicate admin function names before saving.
 * Returns the cleaned list plus the specific names that were rejected so the
 * caller can surface which value is invalid.
 */
export function sanitizeAdminFunctionNames(names: string[]): {
  valid: string[]
  invalid: string[]
} {
  const valid: string[] = []
  const invalid: string[] = []
  const seen = new Set<string>()

  for (const raw of names) {
    const name = typeof raw === 'string' ? raw.trim() : ''
    if (!isValidFunctionName(name)) {
      invalid.push(name)
      continue
    }
    if (seen.has(name)) continue
    seen.add(name)
    valid.push(name)
  }

  return { valid, invalid }
}

/**
 * Filter params supported by the contracts page. The dashboard stat tiles
 * link to `/contracts?filter=alerts-today` and `/contracts?filter=webhooks`,
 * so the page needs to understand these values.
 */
export type ContractFilter = 'alerts-today' | 'webhooks'

export const CONTRACT_FILTERS: readonly ContractFilter[] = ['alerts-today', 'webhooks']

export const CONTRACT_FILTER_LABELS: Record<ContractFilter, string> = {
  'alerts-today': 'Alerts today',
  webhooks: 'Active webhooks',
}

/**
 * Normalize an arbitrary `?filter=` value into a supported ContractFilter.
 * Returns null for missing/unknown values so callers can ignore them.
 */
export function parseContractFilter(value: string | null | undefined): ContractFilter | null {
  if (!value) return null
  return (CONTRACT_FILTERS as readonly string[]).includes(value)
    ? (value as ContractFilter)
    : null
}

/**
 * Whether a contract has had an alert since local midnight.
 * Accepts the last-alert timestamp from the contract record; missing or
 * unparseable timestamps are treated as "no alert today".
 */
export function hasAlertSinceLocalMidnight(
  contract: WatchedContract,
  now: Date = new Date(),
): boolean {
  const raw = (contract as { lastAlertAt?: string | null }).lastAlertAt
  if (!raw) return false
  const ts = new Date(raw).getTime()
  if (Number.isNaN(ts)) return false
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return ts >= midnight
}

/**
 * Whether a contract has at least one active webhook configured.
 */
export function hasActiveWebhooks(contract: WatchedContract): boolean {
  const webhooks = (contract as { webhooks?: unknown }).webhooks
  if (!Array.isArray(webhooks)) return false
  return webhooks.some((hook) => {
    if (!hook || typeof hook !== 'object') return false
    return (hook as { active?: boolean }).active !== false
  })
}

/**
 * Apply a contracts-page filter to a list of contracts. Unknown filters
 * return the list unchanged.
 */
export function applyContractFilter(
  contracts: WatchedContract[],
  filter: ContractFilter | null,
  now: Date = new Date(),
): WatchedContract[] {
  if (!filter) return contracts
  if (filter === 'alerts-today') {
    return contracts.filter((contract) => hasAlertSinceLocalMidnight(contract, now))
  }
  if (filter === 'webhooks') {
    return contracts.filter((contract) => hasActiveWebhooks(contract))
  }
  return contracts
}

export function isApiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_URL)
}

export function listContracts(): Promise<WatchedContract[]> {
  return apiFetch<WatchedContract[]>('/contracts')
}

export function createContract(contract: WatchedContract): Promise<WatchedContract> {
  return apiFetch<WatchedContract>('/contracts', {
    method: 'POST',
    body: JSON.stringify(contract),
  })
}

export function updateContract(contract: WatchedContract): Promise<WatchedContract> {
  return apiFetch<WatchedContract>(`/contracts/${encodeURIComponent(contract.id)}`, {
    method: 'PUT',
    body: JSON.stringify(contract),
  })
}

export async function removeContract(id: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? ''
  const res = await fetch(`${base}/contracts/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}
