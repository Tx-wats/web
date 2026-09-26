import type { AlertRule, AlertRuleType, Network, WatchedContract } from '@/types'
import { isValidContractId, isValidUrl, isValidFunctionName } from '@/lib/stellar'

/** Export file format, aligned with WatchedContract (uses contract_id, not address). */
export interface ContractsSnapshot {
  version: 1
  exportedAt: string
  count: number
  contracts: WatchedContract[]
}

export interface ImportEntryError {
  index: number
  message: string
}

export interface ImportParseResult {
  contracts: WatchedContract[]
  errors: ImportEntryError[]
}

const NETWORKS: Network[] = ['mainnet', 'testnet', 'futurenet']
const RULE_TYPES: AlertRuleType[] = [
  'LargeTransfer',
  'AdminFunctionCalled',
  'AnyTransaction',
  'FunctionCalled',
  'TransactionFailed',
]

/** Soroban symbols are limited to 32 characters. */
const MAX_SYMBOL_LENGTH = 32

/**
 * Validates and de-duplicates a list of function names.
 * Returns the cleaned list or an error message naming the offending value.
 */
function normalizeFunctionNames(names: string[]): string[] | string {
  const seen = new Set<string>()
  const result: string[] = []
  for (const name of names) {
    if (name.length > MAX_SYMBOL_LENGTH) {
      return `function name "${name}" exceeds ${MAX_SYMBOL_LENGTH} characters`
    }
    if (!isValidFunctionName(name)) {
      return `invalid function name "${name}"`
    }
    if (seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
}

export function buildSnapshot(contracts: WatchedContract[]): ContractsSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: contracts.length,
    contracts,
  }
}

function validateRule(rule: unknown): string | null {
  if (typeof rule !== 'object' || rule === null) return 'rule must be an object'
  const r = rule as AlertRule
  if (!RULE_TYPES.includes(r.type)) return `unknown rule type "${String(r.type)}"`
  if (r.threshold_xlm !== undefined && (typeof r.threshold_xlm !== 'number' || r.threshold_xlm < 0)) {
    return 'threshold_xlm must be a non-negative number'
  }
  if (r.function_names !== undefined && !(Array.isArray(r.function_names) && r.function_names.every((n) => typeof n === 'string'))) {
    return 'function_names must be an array of strings'
  }
  if (r.type === 'AdminFunctionCalled' && Array.isArray(r.function_names)) {
    const normalized = normalizeFunctionNames(r.function_names)
    if (typeof normalized === 'string') return normalized
    r.function_names = normalized
  }
  return null
}

/** Returns a normalized contract or an error message for a single entry. */
export function validateContractEntry(entry: unknown): WatchedContract | string {
  if (typeof entry !== 'object' || entry === null) return 'entry must be an object'
  const e = entry as Record<string, unknown>
  if (typeof e.contract_id !== 'string' || !isValidContractId(e.contract_id)) return 'invalid contract_id'
  if (!NETWORKS.includes(e.network as Network)) return 'invalid network'
  if (typeof e.webhook_url !== 'string' || !isValidUrl(e.webhook_url)) return 'invalid webhook_url'
  if (!Array.isArray(e.rules)) return 'rules must be an array'
  for (const rule of e.rules) {
    const err = validateRule(rule)
    if (err) return err
  }
  const now = Date.now()
  return {
    id: typeof e.id === 'string' && e.id ? e.id : `${e.contract_id}:${e.network}`,
    label: typeof e.label === 'string' && e.label.trim() ? e.label : e.contract_id,
    contract_id: e.contract_id,
    network: e.network as Network,
    rules: e.rules as AlertRule[],
    webhook_url: e.webhook_url,
    created_at: typeof e.created_at === 'number' ? e.created_at : now,
    updated_at: typeof e.updated_at === 'number' ? e.updated_at : now,
  }
}

/**
 * Parses an export file. Throws only when the file as a whole is unusable
 * (bad JSON / wrong envelope); per-entry problems are reported in `errors`.
 */
export function parseImport(json: string): ImportParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON: cannot parse contract snapshot')
  }
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { version?: unknown; contracts?: unknown } | null)?.contracts
  if (
    !Array.isArray(list) ||
    (!Array.isArray(parsed) && (parsed as { version?: unknown }).version !== 1)
  ) {
    throw new Error('Invalid snapshot format: expected { version: 1, contracts: [...] }')
  }
  const contracts: WatchedContract[] = []
  const errors: ImportEntryError[] = []
  list.forEach((entry, index) => {
    const result = validateContractEntry(entry)
    if (typeof result === 'string') errors.push({ index, message: result })
    else contracts.push(result)
  })
  return { contracts, errors }
}

export type ImportMode = 'merge' | 'replace'
export type DuplicateStrategy = 'skip' | 'overwrite'

export interface ImportPlan {
  toSave: WatchedContract[]
  toDeleteIds: string[]
  duplicates: WatchedContract[]
}

/** Duplicate = same contract_id + network as an existing contract. */
export function planImport(
  existing: WatchedContract[],
  incoming: WatchedContract[],
  mode: ImportMode,
  duplicates: DuplicateStrategy,
): ImportPlan {
  const key = (c: WatchedContract) => `${c.network}:${c.contract_id}`
  const byKey = new Map(existing.map((c) => [key(c), c]))
  const dups: WatchedContract[] = []
  const toSave: WatchedContract[] = []
  for (const c of incoming) {
    const match = byKey.get(key(c))
    if (mode === 'merge' && match) {
      dups.push(c)
      if (duplicates === 'overwrite') toSave.push({ ...c, id: match.id })
    } else {
      toSave.push(c)
    }
  }
  const toDeleteIds = mode === 'replace' ? existing.map((c) => c.id) : []
  return { toSave, toDeleteIds, duplicates: dups }
}
