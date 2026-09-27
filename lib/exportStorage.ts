import { CONTRACTS_KEY } from './storage';

export interface ContractExportSnapshot {
  version: 1;
  exportedAt: string;
  count: number;
  contracts: StoredContractExport[];
}

export interface StoredContractExport {
  id: string;
  address: string;
  label: string;
  network: string;
  [key: string]: unknown;
}

function readContractsFromStorage(storageKey: string): StoredContractExport[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    return JSON.parse(raw) as StoredContractExport[];
  } catch {
    console.warn(`[exportStorage] Could not read key "${storageKey}" from localStorage`);
    return [];
  }
}

export function buildContractSnapshot(
  storageKey = CONTRACTS_KEY,
): ContractExportSnapshot {
  const contracts = readContractsFromStorage(storageKey);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: contracts.length,
    contracts,
  };
}

export function exportContractsAsJson(storageKey?: string): string {
  return JSON.stringify(buildContractSnapshot(storageKey), null, 2);
}

export function exportContractsAsBlob(storageKey?: string): Blob {
  return new Blob([exportContractsAsJson(storageKey)], { type: 'application/json' });
}

export function parseContractSnapshot(json: string): ContractExportSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON: cannot parse contract snapshot');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as ContractExportSnapshot).version !== 1 ||
    !Array.isArray((parsed as ContractExportSnapshot).contracts)
  ) {
    throw new Error(
      'Invalid snapshot format: expected { version: 1, contracts: [...] }',
    );
  }

  return parsed as ContractExportSnapshot;
}

function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toIsoUtc(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function formatDateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function sanitizeFileSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

export function buildContractExportFilename(
  label: string,
  network: string,
  date = new Date(),
): string {
  return `txwatch-${sanitizeFileSegment(label)}-${sanitizeFileSegment(network)}-${formatDateStamp(date)}.csv`;
}

export function exportContractsAsCsv(
  storageKey?: string,
  label = 'contracts',
  network = 'all',
): string {
  const { contracts } = buildContractSnapshot(storageKey);
  const header = ['id', 'address', 'label', 'network', 'contractId', 'exportedAt'];
  const rows = contracts.map((contract) => [
    escapeCsvField(contract.id),
    escapeCsvField(contract.address),
    escapeCsvField(contract.label),
    escapeCsvField(contract.network),
    escapeCsvField(contract.contractId ?? contract.id),
    escapeCsvField(toIsoUtc(contract.exportedAt ?? new Date())),
  ]);
  return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function downloadContractExport(
  storageKey?: string,
  label = 'contracts',
  network = 'all',
): void {
  const csv = exportContractsAsCsv(storageKey, label, network);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildContractExportFilename(label, network);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
