'use client'

import { AlertPayload, AlertRuleType } from '@/types'
import { explorerTxUrl } from '@/lib/stellar'
import { Network } from '@/types'
import EmptyState from './EmptyState'
import { truncateId } from '@/lib/stellar'
import CopyButton from '@/components/CopyButton'
import { formatDateTime } from '@/lib/format'
import { formatAmount } from '@/lib/formatAmount'
import { useState } from 'react'
import AlertRuleBadge from './AlertRuleBadge'
import Modal from './Modal'
import WebhookLogCard from './WebhookLogCard'

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
  const [selectedAlert, setSelectedAlert] = useState<AlertPayload | null>(null)

  const filteredAlerts = selectedFilter
    ? alerts.filter((a) => a.rule_triggered === selectedFilter)
    : alerts

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
          All Rules
        </button>
        {ruleTypes.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedFilter === type
                ? 'bg-indigo-600 text-white'
                : 'border border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Export and Results */}
      <div className="overflow-x-auto">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-zinc-500">
            {filteredAlerts.length} of {alerts.length} alerts
          </span>
          <button
            onClick={() => exportCSV(filteredAlerts)}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Export CSV
          </button>
        </div>
        {filteredAlerts.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4">No alerts match the selected filter.</p>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="space-y-3 md:hidden">
              {filteredAlerts.map((alert, i) => (
                <WebhookLogCard
                  key={i}
                  alert={alert}
                  network={network}
                  onClick={() => setSelectedAlert(alert)}
                />
              ))}
            </div>
            {/* Desktop table layout */}
            <table className="hidden md:table w-full text-sm">
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
                {filteredAlerts.map((alert, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedAlert(alert)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedAlert(alert)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label="View alert details"
                    className="hover:bg-zinc-800/30 transition-colors cursor-pointer focus:outline-none focus:bg-zinc-800/50"
                  >
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
                          onClick={(e) => e.stopPropagation()}
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
                      {alert.amount !== undefined ? `${formatAmount(alert.amount)} XLM` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Alert Detail Drawer */}
      <Modal
        isOpen={selectedAlert !== null}
        onClose={() => setSelectedAlert(null)}
        title="Alert Details"
      >
        {selectedAlert && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <CopyButton text={JSON.stringify(selectedAlert, null, 2)} label="Copy JSON" />
              <a
                href={explorerTxUrl(network, selectedAlert.transaction_hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-700 text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                Open in explorer
              </a>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-xs text-zinc-300">
              {JSON.stringify(selectedAlert, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  )
}
