'use client'

import { AlertPayload, AlertRuleType } from '@/types'
import { explorerTxUrl } from '@/lib/stellar'
import { Network } from '@/types'
import EmptyState from './EmptyState'
import { truncateId } from '@/lib/stellar'
import CopyButton from '@/components/CopyButton'
import { formatDateTime } from '@/lib/format'
import { useEffect, useMemo, useState } from 'react'
import AlertRuleBadge from './AlertRuleBadge'
import SortToggle from './SortToggle'
import { useSortedLog } from '@/hooks/useSortedLog'
import { RULE_META } from '@/lib/ruleMeta'

type DateRange = 'all' | '24h' | '7d' | '30d' | 'custom'

const DAY_MS = 24 * 60 * 60 * 1000
const PAGE_SIZES = [25, 50, 100] as const

const rangePresets: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'custom', label: 'Custom' },
]

interface WebhookLogProps {
  alerts: AlertPayload[]
  network: Network
}

const ruleTypes: AlertRuleType[] = [
  'LargeTransfer',
  'AdminFunctionCalled',
  'AnyTransaction',
  'FunctionCalled',
  'TransactionFailed',
]

function exportCSV(alerts: AlertPayload[]) {
  const rows = [
    ['Time', 'Rule', 'Tx Hash', 'Function', 'Amount'],
    ...alerts.map((a) => [
      new Date(a.timestamp).toLocaleString(),
      a.rule_triggered,
      a.transaction_hash,
      a.function_name ?? 'N/A',
      a.amount !== undefined ? `${a.amount} XLM` : 'N/A',
    ]),
  ]
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'alerts.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function WebhookLog({ alerts, network }: WebhookLogProps) {
  const [selectedFilter, setSelectedFilter] = useState<AlertRuleType | null>(null)
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<DateRange>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0])
  const [page, setPage] = useState(0)

  const ruleCounts = useMemo(() => {
    const counts = new Map<AlertRuleType, number>()
    for (const a of alerts) {
      const type = a.rule_triggered as AlertRuleType
      counts.set(type, (counts.get(type) ?? 0) + 1)
    }
    return counts
  }, [alerts])

  const presentRuleTypes = ruleTypes.filter((type) => ruleCounts.has(type))

  const filteredAlerts = useMemo(() => {
    const query = search.trim().toLowerCase()
    let from = -Infinity
    let to = Infinity
    if (range === 'custom') {
      if (customFrom) from = new Date(`${customFrom}T00:00:00`).getTime()
      if (customTo) to = new Date(`${customTo}T23:59:59.999`).getTime()
    } else if (range !== 'all') {
      const days = range === '24h' ? 1 : range === '7d' ? 7 : 30
      from = Date.now() - days * DAY_MS
    }
    return alerts.filter((a) => {
      if (selectedFilter && a.rule_triggered !== selectedFilter) return false
      if (a.timestamp < from || a.timestamp > to) return false
      if (
        query &&
        !a.transaction_hash.toLowerCase().includes(query) &&
        !(a.function_name ?? '').toLowerCase().includes(query)
      ) {
        return false
      }
      return true
    })
  }, [alerts, selectedFilter, search, range, customFrom, customTo])

  const { sortedEntries, sortDirection, toggleSort } = useSortedLog(filteredAlerts, 'desc')

  const pageCount = Math.max(1, Math.ceil(sortedEntries.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const pageStart = currentPage * pageSize
  const pageAlerts = sortedEntries.slice(pageStart, pageStart + pageSize)

  useEffect(() => {
    setPage(0)
  }, [selectedFilter, search, range, customFrom, customTo, pageSize, sortDirection])

  if (alerts.length === 0) {
    return (
      <EmptyState
        title="No alerts yet"
        description="Alerts will appear here once your contract triggers a matching rule."
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedFilter === null
              ? 'bg-indigo-600 text-white'
              : 'border border-zinc-700 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          All Rules ({alerts.length})
        </button>
        {presentRuleTypes.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedFilter === type
                ? 'bg-indigo-600 text-white'
                : 'border border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {RULE_META[type]?.label ?? type} ({ruleCounts.get(type)})
          </button>
        ))}
      </div>

      {/* Search and Date Range */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tx hash or function"
          aria-label="Search alerts by transaction hash or function"
          className="flex-1 min-w-[12rem] rounded-lg border border-zinc-700 bg-transparent px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Date range">
          {rangePresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setRange(preset.value)}
              aria-pressed={range === preset.value}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === preset.value
                  ? 'bg-indigo-600 text-white'
                  : 'border border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="From date"
              className="rounded-lg border border-zinc-700 bg-transparent px-2 py-1 text-zinc-200"
            />
            <span>to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="To date"
              className="rounded-lg border border-zinc-700 bg-transparent px-2 py-1 text-zinc-200"
            />
          </div>
        )}
      </div>

      {/* Export and Results */}
      <div className="overflow-x-auto">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-zinc-500">
            {filteredAlerts.length} of {alerts.length} alerts
          </span>
          <div className="flex items-center gap-4">
            <SortToggle direction={sortDirection} onToggle={toggleSort} />
            <button
              onClick={() => exportCSV(sortedEntries)}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
        {filteredAlerts.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4">No alerts match the selected filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Rule</th>
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Tx Hash</th>
                <th className="pb-3 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Function</th>
                <th className="pb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {pageAlerts.map((alert, i) => (
                <tr key={`${alert.transaction_hash}-${pageStart + i}`} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 pr-4 text-zinc-400 whitespace-nowrap">
                    {formatDateTime(alert.timestamp)}
                  </td>
                  <td className="py-3 pr-4">
                    <AlertRuleBadge type={alert.rule_triggered as AlertRuleType} />
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-2">
                      <a
                        href={explorerTxUrl(network, alert.transaction_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {truncateId(alert.transaction_hash)}
                      </a>
                      <CopyButton text={alert.transaction_hash} />
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-zinc-400">
                    {alert.function_name ?? 'N/A'}
                  </td>
                  <td className="py-3 text-zinc-400">
                    {alert.amount !== undefined ? `${alert.amount} XLM` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filteredAlerts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-zinc-500">
            <label className="flex items-center gap-2">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-zinc-700 bg-transparent px-2 py-1 text-zinc-200"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-3">
              <span>
                {pageStart + 1}–{pageStart + pageAlerts.length} of {sortedEntries.length}
              </span>
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 0}
                aria-label="Previous page"
                className="px-2 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span>
                Page {currentPage + 1} of {pageCount}
              </span>
              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= pageCount - 1}
                aria-label="Next page"
                className="px-2 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
