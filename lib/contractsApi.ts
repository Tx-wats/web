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
