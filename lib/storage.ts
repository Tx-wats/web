import { WatchedContract, AlertPayload, Network } from '@/types'
import { HORIZON_URLS } from './stellar'
import { safeParseStorage } from './storageLogger'

export const CONTRACTS_KEY = 'txwatch_contracts'
const ALERTS_KEY = 'txwatch_alerts'
const STORAGE_VERSION_KEY = 'txwatch_storage_version'
const CURRENT_STORAGE_VERSION = 1
const STORAGE_EVENT = 'txwatch:storage'

function getStorage(): Storage | undefined {
  if (typeof window !== 'undefined') return window.localStorage
  return (globalThis as unknown as { localStorage?: Storage }).localStorage
}

function load<T>(key: string): T[] {
  const storage = getStorage()
  if (!storage) return []
  return safeParseStorage<T[]>(key, [])
}

const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 // 5MB typical limit
const MAX_ALERTS_PER_CONTRACT = 500
const DEFAULT_RETENTION_DAYS = 90
const RETENTION_KEY = 'txwatch_alert_retention_days'

export function getRetentionDays(): number {
  const raw = Number(getStorage()?.getItem(RETENTION_KEY))
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_RETENTION_DAYS
}

export function setRetentionDays(days: number) {
  const storage = getStorage()
  if (!storage || !Number.isFinite(days) || days < 1) return
  storage.setItem(RETENTION_KEY, String(Math.floor(days)))
  pruneOldAlerts()
}

function getStorageSize(): number {
  const storage = getStorage()
  if (!storage) return 0
  let size = 0
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key) continue
    const value = storage.getItem(key)
    if (value !== null) {
      size += (value.length + key.length) * 2 // UTF-16: 2 bytes per code unit
    }
  }
  return size
}

export function pruneOldAlerts() {
  const storage = getStorage()
  if (!storage) return
  const cutoff = Date.now() - getRetentionDays() * 24 * 60 * 60 * 1000
  const alerts = load<AlertPayload>(ALERTS_KEY)
  const pruned = alerts.filter((a) => a.timestamp >= cutoff)
  if (pruned.length < alerts.length) {
    try {
      storage.setItem(ALERTS_KEY, JSON.stringify(pruned))
    } catch {
      // best effort
    }
  }
}

function trimAlertsToCutoff(cutoff: number) {
  const storage = getStorage()
  if (!storage) return
  const alerts = load<AlertPayload>(ALERTS_KEY)
  const trimmed = alerts.filter((a) => a.timestamp >= cutoff)
  if (trimmed.length < alerts.length) {
    storage.setItem(ALERTS_KEY, JSON.stringify(trimmed))
  }
}

function isQuotaError(err: unknown): boolean {
  const e = err as { name?: string; code?: number } | null
  return (
    !!e &&
    (e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014)
  )
}

// Writes a value; on quota errors prunes old alerts and retries once.
function writeItem(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value)
    return true
  } catch (err) {
    if (!isQuotaError(err)) return false
  }
  pruneOldAlerts()
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function notifyChange(key: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key } }))
}

function save<T>(key: string, data: T[]): boolean {
  const ok = saveInternal(key, data)
  if (ok) notifyChange(key)
  return ok
}

function saveInternal<T>(key: string, data: T[]): boolean {
  const storage = getStorage()
  if (!storage) return false

  if (key !== ALERTS_KEY) {
    pruneOldAlerts()
  }

  if (key === ALERTS_KEY) {
    const size = getStorageSize()
    if (size > STORAGE_QUOTA_BYTES * 0.9) {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      data = (data as AlertPayload[]).filter((a) => a.timestamp >= cutoff) as unknown as T[]
    }
    return writeItem(storage, key, JSON.stringify(data))
  }

  const ok = writeItem(storage, key, JSON.stringify(data))

  const size = getStorageSize()
  if (size > STORAGE_QUOTA_BYTES * 0.9) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    trimAlertsToCutoff(cutoff)
  }
  return ok
}

function getStorageVersion(): number {
  const storage = getStorage()
  if (!storage) return CURRENT_STORAGE_VERSION
  return parseInt(storage.getItem(STORAGE_VERSION_KEY) ?? '0', 10)
}

function setStorageVersion(version: number) {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(STORAGE_VERSION_KEY, version.toString())
}

export function migrateStorage(migrations: Record<number, () => void>) {
  const currentVersion = getStorageVersion()
  for (let v = currentVersion + 1; v <= CURRENT_STORAGE_VERSION; v++) {
    if (migrations[v]) {
      migrations[v]()
    }
  }
  setStorageVersion(CURRENT_STORAGE_VERSION)
}

export function getContracts(): WatchedContract[] {
  return load<WatchedContract>(CONTRACTS_KEY)
}

export function getContract(id: string): WatchedContract | undefined {
  return getContracts().find((c) => c.id === id)
}

export function getNetworkDistribution(): Record<Network, number> {
  return getContracts().reduce((counts, contract) => {
    counts[contract.network] = (counts[contract.network] ?? 0) + 1
    return counts
  }, {} as Record<Network, number>)
}

export function getContractByIdAndNetwork(
  contractId: string,
  network: string
): WatchedContract | undefined {
  return getContracts().find((c) => c.contract_id === contractId && c.network === network)
}

export class DuplicateContractError extends Error {
  constructor(contractId: string, network: string) {
    super(`Contract ${contractId} is already registered on ${network}`)
    this.name = 'DuplicateContractError'
  }
}

export function addContract(contract: WatchedContract) {
  if (getContractByIdAndNetwork(contract.contract_id, contract.network)) {
    throw new DuplicateContractError(contract.contract_id, contract.network)
  }
  saveContract(contract)
}

export function saveContract(contract: WatchedContract): boolean {
  const contracts = getContracts()
  const updated = { ...contract, updated_at: Date.now() }
  const index = contracts.findIndex((c) => c.id === contract.id)
  if (index === -1) {
    return save(CONTRACTS_KEY, [...contracts, updated])
  }
  const next = contracts.slice()
  next[index] = updated
  return save(CONTRACTS_KEY, next)
}

export function deleteContract(id: string) {
  const contract = getContract(id)
  save(CONTRACTS_KEY, getContracts().filter((c) => c.id !== id))
  if (contract) {
    deleteAlerts(contract.contract_id)
  }
}

export function deleteAlerts(contractId: string) {
  const alerts = load<AlertPayload>(ALERTS_KEY)
  save(ALERTS_KEY, alerts.filter((a) => a.contract_id !== contractId))
}

export function deleteAlert(alertId: string) {
  const alerts = load<AlertPayload & { id?: string }>(ALERTS_KEY)
  save(ALERTS_KEY, alerts.filter((a) => a.id !== alertId))
}

export function getAlerts(contractId: string): AlertPayload[] {
  return load<AlertPayload>(ALERTS_KEY).filter(
    (a) => a.contract_id === contractId
  )
}

export function seedMockAlerts(
  contractId: string,
  network: Network,
  count = 5
): void {
  const now = Date.now()
  for (let index = count - 1; index >= 0; index--) {
    const sequence = index + 1
    const hash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    addAlert({
      label: `Mock Alert ${sequence}`,
      contract_id: contractId,
      network,
      rule_triggered: 'AnyTransaction',
      transaction_hash: hash,
      amount: 10 + index * 5,
      timestamp: now - index * 15 * 60 * 1000,
      horizon_link: `${HORIZON_URLS[network]}/transactions/${hash}`,
    })
  }
}

export function addAlert(alert: AlertPayload | (AlertPayload & { contractId?: string; id?: string })) {
  const normalizedAlert = {
    ...alert,
    contract_id: alert.contract_id ?? (alert as { contractId?: string }).contractId,
  }
  const all = [...load<AlertPayload>(ALERTS_KEY), normalizedAlert]
  const counts: Record<string, number> = {}
  save(ALERTS_KEY, all.filter((a) => {
    counts[a.contract_id] = (counts[a.contract_id] ?? 0) + 1
    return counts[a.contract_id] <= MAX_ALERTS_PER_CONTRACT
  }))
}
