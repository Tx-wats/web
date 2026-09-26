import { WatchedContract } from '@/types'

export type SortOption = 'newest' | 'oldest' | 'label-asc' | 'label-desc'
export interface StoredContract {
  id: string;
  address: string;
  label: string;
  network: string;
  [key: string]: unknown;
}

export type ContractViewMode = "flat" | "grouped";
export type ContractSortBy = "network" | "label" | "id";

export interface ContractPrefs {
  viewMode: ContractViewMode;
  sortBy: ContractSortBy;
}

export const CONTRACT_PREFS_KEY = "txwatch_prefs";

export const DEFAULT_CONTRACT_PREFS: ContractPrefs = {
  viewMode: "flat",
  sortBy: "network",
};

const VIEW_MODES: ContractViewMode[] = ["flat", "grouped"];
const SORT_OPTIONS: ContractSortBy[] = ["network", "label", "id"];

function isViewMode(value: unknown): value is ContractViewMode {
  return typeof value === "string" && (VIEW_MODES as string[]).includes(value);
}

function isSortBy(value: unknown): value is ContractSortBy {
  return typeof value === "string" && (SORT_OPTIONS as string[]).includes(value);
}

/**
 * Read persisted contract view preferences from localStorage.
 * Falls back to defaults when storage is unavailable or holds invalid data.
 */
export function loadContractPrefs(): ContractPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_CONTRACT_PREFS };

  try {
    const raw = window.localStorage.getItem(CONTRACT_PREFS_KEY);
    if (!raw) return { ...DEFAULT_CONTRACT_PREFS };

    const parsed = JSON.parse(raw) as Partial<ContractPrefs> | null;
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_CONTRACT_PREFS };
    }

    return {
      viewMode: isViewMode(parsed.viewMode)
        ? parsed.viewMode
        : DEFAULT_CONTRACT_PREFS.viewMode,
      sortBy: isSortBy(parsed.sortBy)
        ? parsed.sortBy
        : DEFAULT_CONTRACT_PREFS.sortBy,
    };
  } catch {
    return { ...DEFAULT_CONTRACT_PREFS };
  }
}

/**
 * Persist contract view preferences to localStorage. Failures (e.g. private
 * browsing, quota) are swallowed so the UI keeps working without storage.
 */
export function saveContractPrefs(prefs: ContractPrefs): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CONTRACT_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors; preferences simply won't persist.
  }
}

/**
 * Resolve the effective preferences, letting URL params take precedence over
 * stored preferences. Invalid URL values are ignored in favour of stored ones.
 */
export function resolveContractPrefs(
  params: { view?: string | null; sort?: string | null } = {},
  stored: ContractPrefs = loadContractPrefs(),
): ContractPrefs {
  return {
    viewMode: isViewMode(params.view) ? params.view : stored.viewMode,
    sortBy: isSortBy(params.sort) ? params.sort : stored.sortBy,
  };
}

const NETWORK_ORDER: Record<string, number> = {
  mainnet: 0,
  testnet: 1,
  futurenet: 2,
};

function networkRank(network: string): number {
  return NETWORK_ORDER[network.toLowerCase()] ?? 99;
}

export function sortContracts<T extends StoredContract>(
  contracts: T[],
  sortBy: ContractSortBy = DEFAULT_CONTRACT_PREFS.sortBy,
): T[] {
  return [...contracts].sort((a, b) => {
    if (sortBy === "label") {
      const labelDiff = a.label.toLowerCase().localeCompare(b.label.toLowerCase());
      if (labelDiff !== 0) return labelDiff;
      return a.id.localeCompare(b.id);
    }

    if (sortBy === "id") {
      return a.id.localeCompare(b.id);
    }

    const netDiff = networkRank(a.network) - networkRank(b.network);
    if (netDiff !== 0) return netDiff;

const collator = new Intl.Collator(undefined, { sensitivity: 'base' })

/**
 * Sort a list of watched contracts by the given option.
 *
 * Label sorting uses an `Intl.Collator` with `sensitivity: "base"` so that
 * ordering is case- and locale-aware, and falls back to `created_at` (then
 * `id`) as a stable tie-breaker so equal labels keep a deterministic order.
 */
export function sortContracts(
  contracts: WatchedContract[],
  sortBy: SortOption
): WatchedContract[] {
  const sorted = [...contracts]
  switch (sortBy) {
    case 'oldest':
      return sorted.sort((a, b) => a.created_at - b.created_at)
    case 'label-asc':
      return sorted.sort(
        (a, b) =>
          collator.compare(a.label, b.label) ||
          a.created_at - b.created_at ||
          a.id.localeCompare(b.id)
      )
    case 'label-desc':
      return sorted.sort(
        (a, b) =>
          collator.compare(b.label, a.label) ||
          a.created_at - b.created_at ||
          a.id.localeCompare(b.id)
      )
    case 'newest':
    default:
      return sorted.sort((a, b) => b.created_at - a.created_at)
  }
}
